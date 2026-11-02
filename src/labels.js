export const ORIGINS = [
  {
    id: "REVIEW",
    label: "IT",
    title: "IT",
    description: "Feedback reported by the IT department. Choose a module, filter by type, and track whether each issue is in progress, an expected feature, or completed.",
    register: "Register feedback",
  },
  {
    id: "OPERATIONS",
    label: "Operations",
    title: "Operations",
    description: "Feedback reported by the operations department. Choose a module to see that department’s records.",
    register: "Register feedback",
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
