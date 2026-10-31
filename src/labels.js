export const ORIGINS = [
  {
    id: "REVIEW",
    label: "System review",
    title: "Smart V2 System Review",
    description: "Functional and UI/UX feedback compared with the legacy system. Choose a module, filter by type, and track whether each issue is in progress, an expected feature, or completed.",
    register: "Register feedback",
  },
  {
    id: "OPERATIONS",
    label: "Comments From Operations",
    title: "Comments From Operations",
    description: "Comments and feedback recorded from the operations department about the new system.",
    register: "Register comment",
  },
];

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

export function originById(id) {
  return ORIGINS.find((origin) => origin.id === id) || ORIGINS[0];
}

export function statusById(id) {
  return STATUSES.find((status) => status.id === id);
}
