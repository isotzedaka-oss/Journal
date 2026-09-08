import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Check,
  Clock,
  ListChecks,
  Star,
  TrendingUp,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const COLORS = {
  bg: "#F3EEE2",
  panel: "#FBF8F0",
  panelAlt: "#F3EEDF",
  border: "#DED2B8",
  borderSoft: "#EAE1CB",
  text: "#332C22",
  textMuted: "#8C806A",
  textFaint: "#9C8F72",
  olive: "#6F8C5A",
  oliveDim: "#5A7548",
  mustard: "#B5852E",
  sienna: "#BC5A38",
  siennaDim: "#F3E2D3",
  cardShadow: "0 2px 6px rgba(89, 72, 43, 0.08), 0 1px 2px rgba(89, 72, 43, 0.06)",
};

const MOODS = [
  { key: "good", label: "יום טוב", color: "#6F8C5A" },
  { key: "normal", label: "יום רגיל", color: "#B5852E" },
  { key: "hard", label: "יום מאתגר", color: "#BC5A38" },
];

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const HEB_DAYS_SHORT = ["א","ב","ג","ד","ה","ו","ש"];
const HEB_DAY_NAMES = ["יום ראשון","יום שני","יום שלישי","יום רביעי","יום חמישי","יום שישי","שבת"];
const STICKER_EMOJIS = ["⭐", "🎖️", "📌", "☀️", "🌙", "✔️", "🔥", "🏅"];

const pad = (n) => (String(n).length < 2 ? "0" + n : String(n));
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDateStr = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const isToday = (dateStr) => dateStr === toDateStr(new Date());
const uid = () => Math.random().toString(36).slice(2, 10);

const emptyDay = (date) => ({
  date,
  summary: "",
  mood: null,
  schedule: [],
  tasksToday: [],
  tasksTomorrow: [],
  maintain: [],
  improve: [],
  exceptions: [],
  notes: "",
  stickers: [],
});

function rowToDay(row) {
  return {
    date: row.date,
    summary: row.summary || "",
    mood: row.mood || null,
    schedule: row.schedule || [],
    tasksToday: row.tasks_today || [],
    tasksTomorrow: row.tasks_tomorrow || [],
    maintain: row.maintain || [],
    improve: row.improve || [],
    exceptions: row.exceptions || [],
    notes: row.notes || "",
    stickers: row.stickers || [],
  };
}

function dayToRow(day) {
  return {
    date: day.date,
    summary: day.summary,
    mood: day.mood,
    schedule: day.schedule,
    tasks_today: day.tasksToday,
    tasks_tomorrow: day.tasksTomorrow,
    maintain: day.maintain,
    improve: day.improve,
    exceptions: day.exceptions,
    notes: day.notes,
    stickers: day.stickers,
    updated_at: new Date().toISOString(),
  };
}

async function fetchMonth(year, month) {
  const from = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  const { data, error } = await supabase
    .from("journal_entries")
    .select("date, summary, mood, tasks_today, tasks_tomorrow")
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => {
    const total = (r.tasks_today || []).length + (r.tasks_tomorrow || []).length;
    const open =
      (r.tasks_today || []).filter((t) => !t.done).length +
      (r.tasks_tomorrow || []).filter((t) => !t.done).length;
    map[r.date] = { mood: r.mood, summary: r.summary, tasksTotal: total, tasksOpen: open };
  });
  return map;
}

async function fetchDay(date) {
  const { data, error } = await supabase.from("journal_entries").select("*").eq("date", date).maybeSingle();
  if (error) throw error;
  return data ? rowToDay(data) : null;
}

async function saveDay(day) {
  const { error } = await supabase.from("journal_entries").upsert(dayToRow(day), { onConflict: "date" });
  if (error) throw error;
}

function IconBadge({ children, color }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: 6, background: color + "22", border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, color, title, hint }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <IconBadge color={color}>{icon}</IconBadge>
      <div className="flex-1" style={{ textAlign: "right" }}>
        <div style={{ color: COLORS.text, fontFamily: "'Frank Ruhl Libre', serif", fontSize: 17, fontWeight: 600 }}>{title}</div>
        {hint && <div style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  );
}

function AddRow({ placeholder, onAdd, color }) {
  const [val, setVal] = useState("");
  const submit = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
    setVal("");
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={placeholder}
        style={{ flex: 1, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none" }} />
      <button onClick={submit} style={{ width: 34, height: 34, borderRadius: 8, background: color + "26", border: `1px solid ${color}66`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        <Plus size={17} />
      </button>
    </div>
  );
}

function SimpleList({ items, onAdd, onRemove, placeholder, color }) {
  return (
    <div>
      {items.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 13, fontStyle: "italic" }}>אין רשומות עדיין</div>}
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: color, marginTop: 7, flexShrink: 0 }} />
            <div style={{ flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 1.5 }}>{it}</div>
            <button onClick={() => onRemove(i)} style={{ color: COLORS.textFaint, flexShrink: 0, padding: 2, background: "transparent", border: "none" }}><X size={15} /></button>
          </div>
        ))}
      </div>
      <AddRow placeholder={placeholder} onAdd={onAdd} color={color} />
    </div>
  );
}

function TaskList({ items, onAdd, onToggle, onRemove, placeholder, color }) {
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      {items.length > 0 && <div style={{ color: COLORS.textFaint, fontSize: 12, marginBottom: 6 }}>{done} מתוך {items.length} הושלמו</div>}
      {items.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 13, fontStyle: "italic" }}>אין משימות עדיין</div>}
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "8px 10px", opacity: it.done ? 0.55 : 1 }}>
            <button onClick={() => onToggle(i)} style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${it.done ? color : COLORS.border}`, background: it.done ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {it.done && <Check size={13} color="#fff" />}
            </button>
            <div style={{ flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 1.5, textDecoration: it.done ? "line-through" : "none" }}>{it.text}</div>
            <button onClick={() => onRemove(i)} style={{ color: COLORS.textFaint, flexShrink: 0, padding: 2, background: "transparent", border: "none" }}><X size={15} /></button>
          </div>
        ))}
      </div>
      <AddRow placeholder={placeholder} onAdd={onAdd} color={color} />
    </div>
  );
}

function ScheduleList({ items, onAdd, onRemove, color }) {
  const [time, setTime] = useState("");
  const [text, setText] = useState("");
  const sorted = items.map((it, i) => ({ ...it, _i: i })).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ time: time.trim() || "—", text: text.trim() });
    setTime("");
    setText("");
  };
  return (
    <div>
      {items.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 13, fontStyle: "italic" }}>אין פעילויות בלוז</div>}
      <div className="flex flex-col gap-2">
        {sorted.map((it) => (
          <div key={it._i} className="flex items-center gap-3" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ color, fontWeight: 600, fontSize: 13, minWidth: 60, textAlign: "center", background: color + "1A", borderRadius: 6, padding: "3px 4px", flexShrink: 0 }}>{it.time}</div>
            <div style={{ flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 1.5 }}>{it.text}</div>
            <button onClick={() => onRemove(it._i)} style={{ color: COLORS.textFaint, flexShrink: 0, padding: 2, background: "transparent", border: "none" }}><X size={15} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="שעה" style={{ width: 66, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 8px", color: COLORS.text, fontSize: 13, outline: "none", textAlign: "center" }} />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="פעילות..." style={{ flex: 1, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none" }} />
        <button onClick={submit} style={{ width: 34, height: 34, borderRadius: 8, background: color + "26", border: `1px solid ${color}66`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}><Plus size={17} /></button>
      </div>
    </div>
  );
}

function StickerLayer({ stickers, setStickers }) {
  const dragRef = useRef(null);
  const addSticker = (emoji) => setStickers((prev) => [...prev, { id: uid(), emoji, x: 40 + prev.length * 12, y: 10 + prev.length * 8 }]);
  const onPointerDown = (id) => (e) => {
    const sticker = stickers.find((s) => s.id === id);
    dragRef.current = { id, ox: sticker.x, oy: sticker.y, startX: e.clientX, startY: e.clientY };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setStickers((prev) => prev.map((s) => (s.id === dragRef.current.id ? { ...s, x: dragRef.current.ox + dx, y: dragRef.current.oy + dy } : s)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  return (
    <div>
      <div style={{ position: "relative", height: 60, marginBottom: 4 }}>
        {stickers.map((s) => (
          <div key={s.id} onPointerDown={onPointerDown(s.id)} style={{ position: "absolute", left: s.x, top: s.y, fontSize: 28, cursor: "grab", userSelect: "none", touchAction: "none" }}>{s.emoji}</div>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 6 }}>
        {STICKER_EMOJIS.map((e) => (
          <button key={e} onClick={() => addSticker(e)} style={{ fontSize: 18, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 8px" }}>{e}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: COLORS.textFaint }}>מדבקות - נשמרות עם היום הזה, גוררים בעכבר/אצבע</div>
    </div>
  );
}

function CalendarView({ monthDate, setMonthDate, monthData, loading, error, onSelectDay, onRetry }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonthDate(new Date(year, month - 1, 1))} style={{ color: COLORS.textMuted, padding: 6, background: "transparent", border: "none" }}><ChevronRight size={22} /></button>
        <div style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 20, fontWeight: 600, color: COLORS.text }}>{HEB_MONTHS[month]} {year}</div>
        <button onClick={() => setMonthDate(new Date(year, month + 1, 1))} style={{ color: COLORS.textMuted, padding: 6, background: "transparent", border: "none" }}><ChevronLeft size={22} /></button>
      </div>

      {loading && <div style={{ textAlign: "center", color: COLORS.textFaint, fontSize: 13, padding: 20 }}><Loader2 className="animate-spin" size={18} style={{ display: "inline", verticalAlign: "middle" }} /> טוען...</div>}
      {error && <div style={{ textAlign: "center", color: COLORS.sienna, fontSize: 13, padding: 12 }}>{error} <button onClick={onRetry} style={{ textDecoration: "underline", color: COLORS.olive, background: "transparent", border: "none" }}>נסה שוב</button></div>}

      <div className="grid grid-cols-7 gap-1 mb-2">
        {HEB_DAYS_SHORT.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 12, color: COLORS.textFaint }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
          const info = monthData[dateStr];
          const mood = info && MOODS.find((m) => m.key === info.mood);
          return (
            <button key={i} onClick={() => onSelectDay(dateStr)} style={{ aspectRatio: "1", borderRadius: 10, border: `1px solid ${isToday(dateStr) ? COLORS.olive : COLORS.border}`, background: info ? COLORS.panel : COLORS.panelAlt, boxShadow: info ? COLORS.cardShadow : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 2 }}>
              <span style={{ fontSize: 13, color: COLORS.text, fontWeight: isToday(dateStr) ? 700 : 400 }}>{d}</span>
              {mood && <span style={{ width: 6, height: 6, borderRadius: 3, background: mood.color }} />}
              {info && info.tasksTotal > 0 && <span style={{ fontSize: 9, color: COLORS.textFaint }}>{info.tasksTotal - info.tasksOpen}/{info.tasksTotal}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("calendar");
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthData, setMonthData] = useState({});
  const [monthLoading, setMonthLoading] = useState(true);
  const [monthError, setMonthError] = useState("");

  const [dateStr, setDateStr] = useState(null);
  const [day, setDay] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");

  const loadedRef = useRef(false);
  const lastSavedRef = useRef("");
  const saveTimer = useRef(null);

  const loadMonth = useCallback(async () => {
    setMonthLoading(true);
    setMonthError("");
    try {
      const map = await fetchMonth(monthDate.getFullYear(), monthDate.getMonth());
      setMonthData(map);
    } catch (e) {
      setMonthError(e.message || "טעינה נכשלה");
    } finally {
      setMonthLoading(false);
    }
  }, [monthDate]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const openDay = async (ds) => {
    loadedRef.current = false;
    setDateStr(ds);
    setView("day");
    setDayLoading(true);
    setDayError("");
    setSaveState("idle");
    try {
      const result = await fetchDay(ds);
      const loaded = result || emptyDay(ds);
      setDay(loaded);
      lastSavedRef.current = JSON.stringify(loaded);
    } catch (e) {
      setDayError(e.message || "טעינה נכשלה");
      setDay(emptyDay(ds));
    } finally {
      setDayLoading(false);
      setTimeout(() => { loadedRef.current = true; }, 0);
    }
  };

  const update = (patch) => setDay((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!loadedRef.current || !day) return;
    const currentJSON = JSON.stringify(day);
    if (currentJSON === lastSavedRef.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveDay(day);
        lastSavedRef.current = currentJSON;
        setSaveState("saved");
        setSaveError("");
      } catch (e) {
        setSaveState("error");
        setSaveError(e.message || "שגיאה לא ידועה");
      }
    }, 700);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const retrySave = () => {
    if (!day) return;
    setSaveState("saving");
    saveDay(day)
      .then(() => { lastSavedRef.current = JSON.stringify(day); setSaveState("saved"); setSaveError(""); })
      .catch((e) => { setSaveState("error"); setSaveError(e.message || "שגיאה לא ידועה"); });
  };

  return (
    <div dir="rtl" style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text, paddingBottom: 40 }}>
      <div style={{ padding: "18px 16px 6px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 20, fontWeight: 600 }}>🪖 יומן מפקד</div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>שמירה אוטומטית · Supabase</div>
      </div>

      {view === "calendar" && (
        <CalendarView monthDate={monthDate} setMonthDate={setMonthDate} monthData={monthData} loading={monthLoading} error={monthError} onSelectDay={openDay} onRetry={loadMonth} />
      )}

      {view === "day" && (
        <div style={{ padding: 16 }}>
          <button onClick={() => { setView("calendar"); loadMonth(); }} className="flex items-center gap-1 mb-3" style={{ color: COLORS.textMuted, fontSize: 13, background: "transparent", border: "none" }}>
            <ChevronRight size={16} /> חזרה ללוח השנה
          </button>

          <div style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{dateStr && HEB_DAY_NAMES[parseDateStr(dateStr).getDay()]}</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>{dateStr}</div>

          {dayLoading && <div style={{ textAlign: "center", color: COLORS.textFaint, padding: 30 }}><Loader2 className="animate-spin" size={20} style={{ display: "inline", verticalAlign: "middle" }} /> טוען...</div>}
          {dayError && <div style={{ color: COLORS.sienna, fontSize: 13, marginBottom: 12 }}>{dayError}</div>}

          {!dayLoading && day && (
            <div className="flex flex-col gap-5">
              <StickerLayer stickers={day.stickers} setStickers={(fn) => setDay((prev) => ({ ...prev, stickers: typeof fn === "function" ? fn(prev.stickers) : fn }))} />

              <div>
                <input value={day.summary} onChange={(e) => update({ summary: e.target.value })} placeholder="תמצית היום..."
                  style={{ width: "100%", background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontSize: 14.5, outline: "none" }} />
                <div className="flex gap-2 mt-2">
                  {MOODS.map((m) => (
                    <button key={m.key} onClick={() => update({ mood: day.mood === m.key ? null : m.key })} className="flex items-center gap-1.5"
                      style={{ flex: 1, justifyContent: "center", padding: "7px 6px", borderRadius: 8, border: `1px solid ${day.mood === m.key ? m.color : COLORS.border}`, background: day.mood === m.key ? m.color + "22" : "transparent", color: day.mood === m.key ? m.color : COLORS.textMuted, fontSize: 12.5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: m.color }} />{m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<Clock size={15} color={COLORS.olive} />} color={COLORS.olive} title="הלוז" />
                <ScheduleList items={day.schedule} onAdd={(it) => update({ schedule: [...day.schedule, it] })} onRemove={(i) => update({ schedule: day.schedule.filter((_, idx) => idx !== i) })} color={COLORS.olive} />
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<ListChecks size={15} color={COLORS.olive} />} color={COLORS.olive} title="משימות להיום" />
                <TaskList items={day.tasksToday} onAdd={(v) => update({ tasksToday: [...day.tasksToday, { text: v, done: false }] })} onToggle={(i) => update({ tasksToday: day.tasksToday.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)) })} onRemove={(i) => update({ tasksToday: day.tasksToday.filter((_, idx) => idx !== i) })} placeholder="הוסף משימה..." color={COLORS.olive} />
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<ListChecks size={15} color={COLORS.mustard} />} color={COLORS.mustard} title="משימות למחר" />
                <TaskList items={day.tasksTomorrow} onAdd={(v) => update({ tasksTomorrow: [...day.tasksTomorrow, { text: v, done: false }] })} onToggle={(i) => update({ tasksTomorrow: day.tasksTomorrow.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)) })} onRemove={(i) => update({ tasksTomorrow: day.tasksTomorrow.filter((_, idx) => idx !== i) })} placeholder="הוסף משימה למחר..." color={COLORS.mustard} />
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<Star size={15} color={COLORS.olive} />} color={COLORS.olive} title="דגשים לשימור" />
                <SimpleList items={day.maintain} onAdd={(v) => update({ maintain: [...day.maintain, v] })} onRemove={(i) => update({ maintain: day.maintain.filter((_, idx) => idx !== i) })} placeholder="דגש לשימור..." color={COLORS.olive} />
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<TrendingUp size={15} color={COLORS.mustard} />} color={COLORS.mustard} title="דגשים לשיפור" />
                <SimpleList items={day.improve} onAdd={(v) => update({ improve: [...day.improve, v] })} onRemove={(i) => update({ improve: day.improve.filter((_, idx) => idx !== i) })} placeholder="דגש לשיפור..." color={COLORS.mustard} />
              </div>

              <div style={{ background: COLORS.siennaDim, border: `1px solid ${COLORS.sienna}55`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<AlertTriangle size={15} color={COLORS.sienna} />} color={COLORS.sienna} title="דברים חריגים" />
                <SimpleList items={day.exceptions} onAdd={(v) => update({ exceptions: [...day.exceptions, v] })} onRemove={(i) => update({ exceptions: day.exceptions.filter((_, idx) => idx !== i) })} placeholder="תאר את החריגה..." color={COLORS.sienna} />
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, boxShadow: COLORS.cardShadow }}>
                <SectionHeader icon={<FileText size={15} color={COLORS.textMuted} />} color={COLORS.textMuted} title="הערות" />
                <textarea value={day.notes} onChange={(e) => update({ notes: e.target.value })} rows={4} placeholder="כל דבר נוסף..." style={{ width: "100%", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontSize: 14, outline: "none", resize: "vertical" }} />
              </div>

              <div className="flex items-center justify-between" style={{ position: "sticky", bottom: 0, background: COLORS.bg, paddingTop: 10, paddingBottom: 6 }}>
                <div style={{ fontSize: 12, color: saveState === "error" ? COLORS.sienna : COLORS.textFaint }}>
                  {saveState === "saving" && "שומר..."}
                  {saveState === "saved" && "נשמר ✓"}
                  {saveState === "error" && (
                    <span>
                      {"שגיאה: " + saveError + " "}
                      <button onClick={retrySave} style={{ color: COLORS.olive, textDecoration: "underline", background: "transparent", border: "none" }}>נסה שוב</button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
