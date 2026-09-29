import type { DateSelectArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import './calendar.css';
import type { Tone } from '@/lib/format';

export type CalendarEntry = EventInput & { extendedProps: { patient: string; procedure: string; statusLabel: string; tone: Tone } };

function renderEvent({ event, timeText }: EventContentArg) {
  const { patient, procedure, statusLabel, tone } = event.extendedProps as CalendarEntry['extendedProps'];
  return (
    <div className={`appt appt-${tone}`} title={`${patient} · ${statusLabel}`}>
      <strong>{patient}</strong>
      <span>{timeText}</span>
      <span>{procedure}</span>
    </div>
  );
}

export function CalendarView({ events, onSelect, onOpen }: { events: CalendarEntry[]; onSelect: (selection: DateSelectArg) => void; onOpen: (event: EventClickArg) => void }) {
  return (
    <div className="calendar-wrap">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={ptBrLocale}
        buttonText={{ today: 'Hoje', week: 'Semana', day: 'Dia' }}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
        dayHeaderFormat={{ weekday: 'short', day: '2-digit', month: '2-digit' }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotDuration="01:00:00"
        snapDuration="01:00:00"
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        selectable
        selectMirror
        events={events}
        eventContent={renderEvent}
        select={onSelect}
        eventClick={onOpen}
        height="auto"
        nowIndicator
        weekends={false}
      />
    </div>
  );
}
