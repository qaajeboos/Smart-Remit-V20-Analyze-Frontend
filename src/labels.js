export const CATEGORIES = [
  { id: "LEGACY_PARITY", label: "Legacy Parity", dot: "legacy" },
  { id: "AUTOMATION", label: "Automation", dot: "automation" },
  { id: "UX_UI", label: "UX / UI", dot: "ux" },
  { id: "BUG_UX", label: "Bug / UX", dot: "bug" },
  { id: "CORE_LOGIC", label: "Core Logic", dot: "logic" },
  { id: "BUSINESS_RULE", label: "Business Rule", dot: "business" },
  { id: "INQUIRY", label: "Inquiry", dot: "inquiry" },
];

export const STATUSES = [
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "EXPECTED", label: "Expected feature" },
  { id: "COMPLETED", label: "Completed" },
];

export function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id);
}

export function statusById(id) {
  return STATUSES.find((status) => status.id === id);
}
