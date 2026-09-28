import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';

export type CalendarEntry = EventInput & { extendedProps?: { patientName?: string; status?: string } };
export function CalendarView({ events, onSelect, onOpen }: { events: CalendarEntry[]; onSelect: (selection: DateSelectArg) => void; onOpen: (event: EventClickArg) => void }) {
  return <div className="calendar-wrap"><FullCalendar plugins={[timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" locale={ptBrLocale} headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }} slotDuration="01:00:00" snapDuration="01:00:00" slotMinTime="07:00:00" slotMaxTime="21:00:00" allDaySlot={false} selectable selectMirror events={events} select={onSelect} eventClick={onOpen} height="auto" nowIndicator weekends={false} /></div>;
}
