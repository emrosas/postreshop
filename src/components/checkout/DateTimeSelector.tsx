import { useState, useMemo } from "react";
import { DatePicker, TimeInput } from "@heroui/react";
import { today, getLocalTimeZone, Time } from "@internationalized/date";
import type { DisabledDateTime } from "db/config";
import FormInputError from "@/components/checkout/FormInputError";

type DateTimeSelectorProps = {
  disabledDates: DisabledDateTime[];
  inputErrors: Record<string, string[]>;
  selectedSucursalId?: string;
  onDateChange?: (date: any) => void;
  onTimeChange?: (time: any) => void;
};

export function DateTimeSelector({
  disabledDates,
  inputErrors,
  selectedSucursalId,
  onDateChange,
  onTimeChange,
}: DateTimeSelectorProps) {
  const [date, setDate] = useState<any>(null);
  const [time, setTime] = useState<any>(new Time(13));

  // 📅 Fecha mínima según sucursal y hora actual (horario normal)
  const minimumDate = useMemo(() => {
    const monterreyTimeZone = "America/Monterrey";
    const now = new Date();

    const monterreyTime = new Intl.DateTimeFormat("en-CA", {
      timeZone: monterreyTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const currentHour = parseInt(
      monterreyTime.find((part) => part.type === "hour")?.value || "0",
    );
    const currentMinute = parseInt(
      monterreyTime.find((part) => part.type === "minute")?.value || "0",
    );

    const monterreyDate = new Date().toLocaleDateString("en-CA", {
      timeZone: monterreyTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const [year, month, day] = monterreyDate.split("-").map(Number);
    const monterreyDateObj = new Date(year, month - 1, day);
    const isSunday = monterreyDateObj.getDay() === 0;

    let extraDays = 1;

    switch (selectedSucursalId) {
      case "536":
      case "49":
        extraDays = currentHour >= 20 ? 2 : 1;
        break;
      // ❌ AQUÍ BORRAMOS EL BLOQUE DE SALTILLO (IDs 109, 50, 520) ❌

      default:
        // Ahora Saltillo caerá aquí (Horario normal hasta las 9:30 PM)
        extraDays =
          currentHour > 21 || (currentHour === 21 && currentMinute >= 30)
            ? 2
            : 1;
        break;
    }

    return today(getLocalTimeZone()).add({ days: extraDays });
  }, [selectedSucursalId]);

  const formatDateToString = (date: any): string => {
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    } else {
      const month = date.month.toString().padStart(2, "0");
      const day = date.day.toString().padStart(2, "0");
      return `${date.year}-${month}-${day}`;
    }
  };

  // 🔔 Ventana especial de horarios para 24, 25, 31 dic y 1 ene
  const getSpecialTimeWindow = (
    selectedDate: any,
  ): { min: Time; max: Time } | null => {
    if (!selectedDate) return null;

    const formattedSelectedDate = formatDateToString(selectedDate);
    const [, month, day] = formattedSelectedDate.split("-");
    const mmdd = `${month}-${day}`;

    // 24 y 31 de diciembre → 1 pm a 5 pm
    if (mmdd === "12-24" || mmdd === "12-31") {
      return { min: new Time(13), max: new Time(17) };
    }

    // 25 de diciembre y 1 de enero → 3 pm a 7 pm
    if (mmdd === "12-25" || mmdd === "01-01") {
      return { min: new Time(15), max: new Time(19) };
    }

    return null;
  };

  const isDateUnavailable = (date: any): boolean => {
    const formattedSelectedDate = formatDateToString(date);

    return disabledDates.some((disabledDate) => {
      if (disabledDate.date !== formattedSelectedDate) {
        return false;
      }

      if (disabledDate.dayDisabled === true) {
        return true;
      }

      if (
        disabledDate.sucursales &&
        !disabledDate.productos &&
        selectedSucursalId
      ) {
        let sucursalesArray;
        if (Array.isArray(disabledDate.sucursales)) {
          sucursalesArray = disabledDate.sucursales;
        } else if (typeof disabledDate.sucursales === "string") {
          try {
            sucursalesArray = JSON.parse(disabledDate.sucursales);
          } catch {
            sucursalesArray = [];
          }
        } else {
          sucursalesArray = [];
        }

        return sucursalesArray.includes(selectedSucursalId);
      }

      return false;
    });
  };

  const validateTime = (value: any): true | string | string[] => {
    if (!date) return true;

    const formattedSelectedDate = formatDateToString(date);
    const matchingDateEntry = disabledDates.find(
      (dt) => dt.date === formattedSelectedDate,
    );

    if (!matchingDateEntry) return true;

    if (matchingDateEntry.dayDisabled) {
      return "La fecha está agotada";
    }

    if (matchingDateEntry.time) {
      const disabledTimes = matchingDateEntry.time.split(",");
      const selectedTimeStr = `${value.hour}:00`;
      if (disabledTimes.includes(selectedTimeStr)) {
        return "La hora está agotada";
      }
    }

    return true;
  };

  const handleDateChange = (newDate: any) => {
    setDate(newDate);
    onDateChange?.(newDate);
  };

  const handleTimeChange = (newTime: any) => {
    setTime(newTime);
    onTimeChange?.(newTime);
  };
  // 🔔 Calcular ventana de horarios según la fecha seleccionada
  const SUCURSALES_CIERRE9 = ["50", "109", "520", "536"];
  const specialTimeWindow = getSpecialTimeWindow(date);
  const minTime = specialTimeWindow ? specialTimeWindow.min : new Time(13);
  const defaultMaxTime =
    selectedSucursalId && SUCURSALES_CIERRE9.includes(selectedSucursalId)
      ? new Time(21)
      : new Time(22);
  const maxTime = specialTimeWindow ? specialTimeWindow.max : defaultMaxTime;
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <DatePicker
          name="fecha"
          id="fecha"
          label="Fecha"
          value={date}
          onChange={handleDateChange}
          maxValue={today(getLocalTimeZone()).add({ days: 30 }) as any}
          minValue={minimumDate as any}
          isDateUnavailable={isDateUnavailable}
          isRequired
          radius="sm"
          errorMessage={"Selecciona una fecha"}
        />
        {inputErrors.fecha && (
          <FormInputError error={inputErrors.fecha} name="fecha" />
        )}
      </div>
      <div>
        <TimeInput
          name="hora"
          id="hora"
          aria-describedby="error-hora"
          label="Hora"
          value={time}
          onChange={handleTimeChange}
          minValue={minTime as any}
          maxValue={maxTime as any}
          granularity="hour"
          defaultValue={minTime as any}
          isRequired
          radius="sm"
          validate={validateTime}
        />
      </div>
    </div>
  );
}
