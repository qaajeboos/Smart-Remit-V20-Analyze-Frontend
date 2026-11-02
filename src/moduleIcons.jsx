import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChartColumn,
  ClipboardList,
  Coins,
  Contact,
  CreditCard,
  FileCheck,
  FileText,
  Flag,
  Folder,
  Globe,
  Handshake,
  Headphones,
  Home,
  IdCard,
  Key,
  Landmark,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  List,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Monitor,
  Network,
  Notebook,
  Package,
  Percent,
  Phone,
  PiggyBank,
  Pin,
  Plane,
  Receipt,
  Route,
  Scale,
  Search,
  Send,
  Settings,
  Shield,
  Smartphone,
  Star,
  Store,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
  Wrench,
} from "lucide-react";

export const MODULE_ICONS = [
  { name: "building-2", label: "Building", Icon: Building2 },
  { name: "landmark", label: "Bank", Icon: Landmark },
  { name: "store", label: "Store", Icon: Store },
  { name: "home", label: "Home", Icon: Home },
  { name: "warehouse", label: "Warehouse", Icon: Warehouse },
  { name: "users", label: "Users", Icon: Users },
  { name: "user", label: "User", Icon: User },
  { name: "contact", label: "Contact", Icon: Contact },
  { name: "id-card", label: "Identity", Icon: IdCard },
  { name: "briefcase", label: "Business", Icon: Briefcase },
  { name: "handshake", label: "Agreement", Icon: Handshake },
  { name: "wallet", label: "Wallet", Icon: Wallet },
  { name: "banknote", label: "Money", Icon: Banknote },
  { name: "coins", label: "Coins", Icon: Coins },
  { name: "credit-card", label: "Card", Icon: CreditCard },
  { name: "piggy-bank", label: "Savings", Icon: PiggyBank },
  { name: "receipt", label: "Receipt", Icon: Receipt },
  { name: "percent", label: "Percent", Icon: Percent },
  { name: "calculator", label: "Calculator", Icon: Calculator },
  { name: "scale", label: "Balance", Icon: Scale },
  { name: "arrow-left-right", label: "Transfer", Icon: ArrowLeftRight },
  { name: "send", label: "Send", Icon: Send },
  { name: "globe", label: "Globe", Icon: Globe },
  { name: "map", label: "Map", Icon: MapIcon },
  { name: "map-pin", label: "Location", Icon: MapPin },
  { name: "flag", label: "Flag", Icon: Flag },
  { name: "route", label: "Route", Icon: Route },
  { name: "plane", label: "Travel", Icon: Plane },
  { name: "truck", label: "Delivery", Icon: Truck },
  { name: "phone", label: "Phone", Icon: Phone },
  { name: "mail", label: "Mail", Icon: Mail },
  { name: "message-square", label: "Message", Icon: MessageSquare },
  { name: "headphones", label: "Support", Icon: Headphones },
  { name: "life-buoy", label: "Help", Icon: LifeBuoy },
  { name: "shield", label: "Security", Icon: Shield },
  { name: "lock", label: "Lock", Icon: Lock },
  { name: "key", label: "Key", Icon: Key },
  { name: "badge-check", label: "Verified", Icon: BadgeCheck },
  { name: "file-text", label: "Document", Icon: FileText },
  { name: "file-check", label: "Approved", Icon: FileCheck },
  { name: "clipboard-list", label: "Checklist", Icon: ClipboardList },
  { name: "notebook", label: "Notes", Icon: Notebook },
  { name: "book-open", label: "Guide", Icon: BookOpen },
  { name: "folder", label: "Folder", Icon: Folder },
  { name: "layers", label: "Layers", Icon: Layers },
  { name: "list", label: "List", Icon: List },
  { name: "layout-dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { name: "chart-column", label: "Chart", Icon: ChartColumn },
  { name: "network", label: "Network", Icon: Network },
  { name: "settings", label: "Settings", Icon: Settings },
  { name: "wrench", label: "Tools", Icon: Wrench },
  { name: "package", label: "Package", Icon: Package },
  { name: "monitor", label: "Screen", Icon: Monitor },
  { name: "smartphone", label: "Mobile", Icon: Smartphone },
  { name: "bell", label: "Alert", Icon: Bell },
  { name: "star", label: "Star", Icon: Star },
  { name: "pin", label: "Pin", Icon: Pin },
  { name: "calendar", label: "Calendar", Icon: Calendar },
  { name: "search", label: "Search", Icon: Search },
];

const ICONS_BY_NAME = new Map(MODULE_ICONS.map((icon) => [icon.name, icon]));

export function ModuleMark({ name, size = 16 }) {
  const found = ICONS_BY_NAME.get(name);
  if (!found) return <span className="module-emoji">{name || "📌"}</span>;
  const Icon = found.Icon;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const selected = ICONS_BY_NAME.get(value);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return MODULE_ICONS;
    return MODULE_ICONS.filter((icon) => icon.label.toLowerCase().includes(term) || icon.name.includes(term));
  }, [query]);

  function choose(name) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className="icon-picker" ref={rootRef}>
      <button type="button" className="icon-picker-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <ModuleMark name={value} size={18} />
        <span>{selected ? selected.label : "Choose an icon"}</span>
      </button>
      {open && (
        <div className="icon-picker-panel">
          <input
            type="search"
            value={query}
            placeholder="Search icons"
            aria-label="Search icons"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="icon-grid" role="listbox" aria-label="Icons">
            <button type="button" className={!value ? "active" : ""} onClick={() => choose("")} title="No icon">
              <span className="module-emoji">📌</span>
            </button>
            {visible.map((icon) => (
              <button
                key={icon.name}
                type="button"
                className={value === icon.name ? "active" : ""}
                title={icon.label}
                onClick={() => choose(icon.name)}
              >
                <icon.Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
            ))}
          </div>
          {visible.length === 0 && <p className="field-hint">No icons match that search.</p>}
        </div>
      )}
    </div>
  );
}
