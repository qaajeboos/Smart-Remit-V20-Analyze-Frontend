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
    label: "From Operations",
    title: "From Operations",
    description: "Comments and feedback recorded from the operations department about the new system.",
    register: "Register comment",
  },
];

export const OPERATIONS_TOPICS = [
  {
    id: "FEATURE",
    label: "New features requested",
    title: "New features requested",
    description: "Features the operations department wants added to the new system.",
  },
  {
    id: "BUG",
    label: "Bugs",
    title: "Bugs",
    description: "Defects reported by the operations department.",
  },
  {
    id: "LEGACY_DIFFERENCE",
    label: "Difference between new system and legacy system",
    title: "Difference between new system and legacy system",
    description: "Places where the new system does not match the legacy system.",
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

export function operationsTopicById(id) {
  return OPERATIONS_TOPICS.find((topic) => topic.id === id);
}

export function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id);
}

export function originById(id) {
  return ORIGINS.find((origin) => origin.id === id) || ORIGINS[0];
}

export function statusById(id) {
  return STATUSES.find((status) => status.id === id);
}
