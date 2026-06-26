import { createClient } from "@/lib/supabase/server";
import {
  computeAverageDailyConsumption,
  computeDailyConsumption,
  computeExcessPercent,
  shouldAlertAbnormalConsumption,
} from "@/lib/water-meters/analysis";
import type {
  WaterMeterAlert,
  WaterMeterDashboardSummary,
  WaterMeterReading,
} from "@/lib/water-meters/types";
import { mapSupabaseError, serviceError, type ServiceResult, serviceOk } from "@/lib/services/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const READING_SELECT = `
  id,
  condominium_id,
  reading_date,
  reading_value,
  daily_consumption,
  created_by,
  created_at
`;

type ReadingRow = {
  id: string;
  condominium_id: string;
  reading_date: string;
  reading_value: number;
  daily_consumption: number | null;
  created_by: string;
  created_at: string;
};

async function getAuthorMap(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, { id: string; full_name: string }>();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", profileIds);

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

function mapReadingRow(
  row: ReadingRow,
  author: { id: string; full_name: string } | null,
): WaterMeterReading {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    reading_date: row.reading_date,
    reading_value: Number(row.reading_value),
    daily_consumption:
      row.daily_consumption === null ? null : Number(row.daily_consumption),
    created_by: row.created_by,
    created_at: row.created_at,
    author,
  };
}

async function getAverageConsumptionForDate(
  supabase: SupabaseClient,
  condominiumId: string,
  readingDate: string,
): Promise<number | null> {
  const { data: historyRows, error } = await supabase
    .from("water_meter_readings")
    .select("reading_date, daily_consumption")
    .eq("condominium_id", condominiumId)
    .order("reading_date", { ascending: false })
    .limit(30);

  if (error) {
    return null;
  }

  return computeAverageDailyConsumption(
    (historyRows ?? []).map((row) => ({
      reading_date: row.reading_date,
      daily_consumption:
        row.daily_consumption === null ? null : Number(row.daily_consumption),
    })),
    { excludeDate: readingDate },
  );
}

async function syncWaterMeterAlertForReading(
  supabase: SupabaseClient<Database>,
  input: {
    condominiumId: string;
    readingId: string;
    readingDate: string;
    dailyConsumption: number | null;
    reading?: WaterMeterReading;
  },
): Promise<WaterMeterAlert | null> {
  const averageConsumption = await getAverageConsumptionForDate(
    supabase,
    input.condominiumId,
    input.readingDate,
  );

  const shouldAlert =
    input.dailyConsumption !== null &&
    shouldAlertAbnormalConsumption({
      dailyConsumption: input.dailyConsumption,
      averageConsumption,
    });

  if (
    !shouldAlert ||
    input.dailyConsumption === null ||
    averageConsumption === null
  ) {
    await supabase.from("water_meter_alerts").delete().eq("reading_id", input.readingId);
    return null;
  }

  const excessPercent = computeExcessPercent(input.dailyConsumption, averageConsumption);

  const { data: alertRow, error: alertError } = await supabase
    .from("water_meter_alerts")
    .upsert(
      {
        condominium_id: input.condominiumId,
        reading_id: input.readingId,
        daily_consumption: input.dailyConsumption,
        average_consumption: averageConsumption,
        excess_percent: excessPercent,
      },
      { onConflict: "reading_id" },
    )
    .select(
      "id, condominium_id, reading_id, daily_consumption, average_consumption, excess_percent, created_at",
    )
    .single();

  if (alertError || !alertRow) {
    return null;
  }

  return {
    id: alertRow.id,
    condominium_id: alertRow.condominium_id,
    reading_id: alertRow.reading_id,
    daily_consumption: Number(alertRow.daily_consumption),
    average_consumption: Number(alertRow.average_consumption),
    excess_percent: Number(alertRow.excess_percent),
    created_at: alertRow.created_at,
    reading: input.reading,
  };
}

export async function listWaterMeterReadings(
  condominiumId: string,
  limit = 30,
): Promise<ServiceResult<WaterMeterReading[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("water_meter_readings")
    .select(READING_SELECT)
    .eq("condominium_id", condominiumId)
    .order("reading_date", { ascending: false })
    .limit(limit);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const rows = (data as ReadingRow[] | null) ?? [];
  const authorMap = await getAuthorMap([...new Set(rows.map((row) => row.created_by))]);

  return serviceOk(
    rows.map((row) => mapReadingRow(row, authorMap.get(row.created_by) ?? null)),
  );
}

export async function getLatestWaterMeterAlert(
  condominiumId: string,
): Promise<ServiceResult<WaterMeterAlert | null>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("water_meter_alerts")
    .select(
      "id, condominium_id, reading_id, daily_consumption, average_consumption, excess_percent, created_at",
    )
    .eq("condominium_id", condominiumId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  if (!data) {
    return serviceOk(null);
  }

  return serviceOk({
    id: data.id,
    condominium_id: data.condominium_id,
    reading_id: data.reading_id,
    daily_consumption: Number(data.daily_consumption),
    average_consumption: Number(data.average_consumption),
    excess_percent: Number(data.excess_percent),
    created_at: data.created_at,
  });
}

export async function getWaterMeterDashboardSummary(
  condominiumId: string,
): Promise<ServiceResult<WaterMeterDashboardSummary>> {
  const [readingsResult, alertResult] = await Promise.all([
    listWaterMeterReadings(condominiumId, 30),
    getLatestWaterMeterAlert(condominiumId),
  ]);

  if (!readingsResult.ok) {
    return serviceError(readingsResult.error);
  }

  if (!alertResult.ok) {
    return serviceError(alertResult.error);
  }

  const recentReadings = readingsResult.data;
  const latestReading = recentReadings[0] ?? null;
  const previousReading = recentReadings[1] ?? null;
  const averageConsumption = computeAverageDailyConsumption(
    recentReadings.map((reading) => ({
      reading_date: reading.reading_date,
      daily_consumption: reading.daily_consumption,
    })),
    { excludeDate: latestReading?.reading_date },
  );

  return serviceOk({
    latestReading,
    previousReading,
    averageConsumption,
    activeAlert: alertResult.data,
    recentReadings,
  });
}

export async function createWaterMeterReading(input: {
  condominiumId: string;
  readingDate: string;
  readingValue: number;
  createdBy: string;
}): Promise<
  ServiceResult<{
    reading: WaterMeterReading;
    alert: WaterMeterAlert | null;
  }>
> {
  const supabase = await createClient();

  const { data: previousRow, error: previousError } = await supabase
    .from("water_meter_readings")
    .select(READING_SELECT)
    .eq("condominium_id", input.condominiumId)
    .lt("reading_date", input.readingDate)
    .order("reading_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    return serviceError(mapSupabaseError(previousError));
  }

  const previousValue = previousRow ? Number(previousRow.reading_value) : null;

  if (previousValue !== null && input.readingValue < previousValue) {
    return serviceError("A leitura não pode ser menor que a leitura anterior.");
  }

  const { data: nextRow } = await supabase
    .from("water_meter_readings")
    .select("id, reading_date, reading_value")
    .eq("condominium_id", input.condominiumId)
    .gt("reading_date", input.readingDate)
    .order("reading_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextRow && input.readingValue > Number(nextRow.reading_value)) {
    return serviceError("A leitura não pode ser maior que a leitura do dia seguinte.");
  }

  const dailyConsumption = computeDailyConsumption(input.readingValue, previousValue);

  const { data, error } = await supabase
    .from("water_meter_readings")
    .upsert(
      {
        condominium_id: input.condominiumId,
        reading_date: input.readingDate,
        reading_value: input.readingValue,
        daily_consumption: dailyConsumption,
        created_by: input.createdBy,
      },
      { onConflict: "condominium_id,reading_date" },
    )
    .select(READING_SELECT)
    .single();

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const authorMap = await getAuthorMap([input.createdBy]);
  const reading = mapReadingRow(data as ReadingRow, authorMap.get(input.createdBy) ?? null);

  if (nextRow) {
    const nextDailyConsumption = computeDailyConsumption(
      Number(nextRow.reading_value),
      input.readingValue,
    );
    await supabase
      .from("water_meter_readings")
      .update({ daily_consumption: nextDailyConsumption })
      .eq("id", nextRow.id);

    await syncWaterMeterAlertForReading(supabase, {
      condominiumId: input.condominiumId,
      readingId: nextRow.id,
      readingDate: nextRow.reading_date,
      dailyConsumption: nextDailyConsumption,
    });
  }

  const alert = await syncWaterMeterAlertForReading(supabase, {
    condominiumId: input.condominiumId,
    readingId: reading.id,
    readingDate: reading.reading_date,
    dailyConsumption: reading.daily_consumption,
    reading,
  });

  return serviceOk({ reading, alert });
}

export async function updateWaterMeterReading(input: {
  condominiumId: string;
  readingId: string;
  readingValue: number;
}): Promise<ServiceResult<{ reading: WaterMeterReading; alert: WaterMeterAlert | null }>> {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("water_meter_readings")
    .select(READING_SELECT)
    .eq("id", input.readingId)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (fetchError) {
    return serviceError(mapSupabaseError(fetchError));
  }

  if (!current) {
    return serviceError("Leitura não encontrada.");
  }

  const { data: previousRow, error: previousError } = await supabase
    .from("water_meter_readings")
    .select("reading_value")
    .eq("condominium_id", input.condominiumId)
    .lt("reading_date", current.reading_date)
    .order("reading_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    return serviceError(mapSupabaseError(previousError));
  }

  const previousValue = previousRow ? Number(previousRow.reading_value) : null;

  if (previousValue !== null && input.readingValue < previousValue) {
    return serviceError("A leitura não pode ser menor que a leitura anterior.");
  }

  const { data: nextRow, error: nextError } = await supabase
    .from("water_meter_readings")
    .select("id, reading_date, reading_value")
    .eq("condominium_id", input.condominiumId)
    .gt("reading_date", current.reading_date)
    .order("reading_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextError) {
    return serviceError(mapSupabaseError(nextError));
  }

  if (nextRow && input.readingValue > Number(nextRow.reading_value)) {
    return serviceError("A leitura não pode ser maior que a leitura do dia seguinte.");
  }

  const dailyConsumption = computeDailyConsumption(input.readingValue, previousValue);

  const { data: updated, error: updateError } = await supabase
    .from("water_meter_readings")
    .update({
      reading_value: input.readingValue,
      daily_consumption: dailyConsumption,
    })
    .eq("id", input.readingId)
    .select(READING_SELECT)
    .single();

  if (updateError) {
    return serviceError(mapSupabaseError(updateError));
  }

  const authorMap = await getAuthorMap([updated.created_by]);
  const reading = mapReadingRow(updated as ReadingRow, authorMap.get(updated.created_by) ?? null);

  if (nextRow) {
    const nextDailyConsumption = computeDailyConsumption(
      Number(nextRow.reading_value),
      input.readingValue,
    );

    await supabase
      .from("water_meter_readings")
      .update({ daily_consumption: nextDailyConsumption })
      .eq("id", nextRow.id);

    await syncWaterMeterAlertForReading(supabase, {
      condominiumId: input.condominiumId,
      readingId: nextRow.id,
      readingDate: nextRow.reading_date,
      dailyConsumption: nextDailyConsumption,
    });
  }

  const alert = await syncWaterMeterAlertForReading(supabase, {
    condominiumId: input.condominiumId,
    readingId: reading.id,
    readingDate: reading.reading_date,
    dailyConsumption: reading.daily_consumption,
    reading,
  });

  return serviceOk({ reading, alert });
}
