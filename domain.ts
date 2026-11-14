export const categories = [
  "Electronics",
  "Bags & accessories",
  "Books & stationery",
  "Keys & cards",
  "Clothing",
  "Other",
];
export const buildings = [
  "Central Library",
  "College of Computer Science",
  "Student Center",
  "Science Building",
  "Main Gate",
];
export const points = [
  {
    id: "library",
    name: "Library reception",
    building: "Central Library",
    detail: "Ground floor · information counter",
    x: 29,
    y: 28,
  },
  {
    id: "student",
    name: "Student services desk",
    building: "Student Center",
    detail: "Ground floor · main lobby",
    x: 71,
    y: 35,
  },
  {
    id: "security",
    name: "Main security office",
    building: "Main Gate",
    detail: "Gate entrance · security counter",
    x: 49,
    y: 76,
  },
];
export type Item = {
  id: string;
  type: "lost" | "found";
  title: string;
  description: string;
  category: string;
  building: string;
  date: string;
  point: string | null;
  photo: string | null;
  status: string;
  createdAt: string;
  checkedAt: string | null;
  deskReference: string | null;
  hiddenAt?: string | null;
  hiddenNote?: string | null;
  withdrawnAt?: string | null;
  withdrawReason?: string | null;
  returnedAt?: string | null;
  handedOverAt?: string | null;
  handoverNote?: string | null;
};
export const displayStatus = (i: {
  status: string;
  handedOverAt?: string | null;
}) => (i.status === "awaiting" && i.handedOverAt ? "handedOver" : i.status);
export const statuses: Record<string, string> = {
  lost: "Still missing",
  awaiting: "Awaiting drop-off",
  received: "At collection desk",
  returned: "Returned",
  withdrawn: "Withdrawn",
};
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function validateItem(
  v: Record<string, unknown>,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }),
  lists: { categories: string[]; buildings: string[] } = {
    categories,
    buildings,
  },
) {
  if (!["lost", "found"].includes(String(v.type)))
    return "Select lost or found.";
  if (
    typeof v.title !== "string" ||
    v.title.trim().length < 3 ||
    v.title.trim().length > 100
  )
    return "Enter a title of 3–100 characters.";
  if (
    typeof v.description !== "string" ||
    v.description.trim().length < 10 ||
    v.description.trim().length > 2000
  )
    return "Enter a description of 10–2,000 characters.";
  if (!lists.categories.includes(String(v.category)))
    return "Select an item category.";
  if (!lists.buildings.includes(String(v.building)))
    return "Select a campus building.";
  if (!validDate(String(v.date)) || String(v.date) > today)
    return "Enter a valid date that is not in the future.";
  if (v.type === "found" && !points.some((p) => p.id === v.point))
    return "Select a collection point.";
  return null;
}
