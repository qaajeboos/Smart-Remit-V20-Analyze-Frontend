import pdfMakeModule from "pdfmake/build/pdfmake";
import vfsModule from "pdfmake/build/vfs_fonts";
import { categoryById, statusById } from "./labels";

const pdfMake = pdfMakeModule.default || pdfMakeModule;

const CATEGORY_COLORS = {
  legacy: { color: "#92400e", fill: "#fef3c7" },
  automation: { color: "#065f46", fill: "#d1fae5" },
  ux: { color: "#3730a3", fill: "#e0e7ff" },
  bug: { color: "#9f1239", fill: "#ffe4e6" },
  logic: { color: "#115e59", fill: "#ccfbf1" },
  business: { color: "#9a3412", fill: "#ffedd5" },
  feature: { color: "#075985", fill: "#e0f2fe" },
  inquiry: { color: "#475569", fill: "#f1f5f9" },
};

const STATUS_COLORS = {
  IN_PROGRESS: { color: "#b45309", fill: "#fffbeb", bar: "#d97706" },
  EXPECTED: { color: "#1d4ed8", fill: "#eff6ff", bar: "#2563eb" },
  COMPLETED: { color: "#047857", fill: "#ecfdf5", bar: "#059669" },
};

let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;
  const files = vfsModule?.["Roboto-Regular.ttf"]
    ? vfsModule
    : vfsModule?.vfs || vfsModule?.default || vfsModule;
  pdfMake.addVirtualFileSystem(files);
  fontsReady = true;
}

function formatGenerated(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCreated(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function fileStamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function personCell(name, title) {
  return {
    stack: [
      { text: name, fontSize: 11, bold: true, color: "#1e293b", margin: [0, 0, 0, 2] },
      { text: title, fontSize: 9, color: "#64748b" },
    ],
    fillColor: "#f8fafc",
    margin: [10, 8, 10, 8],
  };
}

function scopeCell(label, value) {
  return {
    stack: [
      { text: label.toUpperCase(), fontSize: 8, color: "#64748b", bold: true, margin: [0, 0, 0, 3] },
      { text: value, fontSize: 11, bold: true, color: "#1e293b" },
    ],
    fillColor: "#f8fafc",
    margin: [10, 8, 10, 8],
  };
}

function itemBlock(item) {
  const category = categoryById(item.category);
  const categoryColor = CATEGORY_COLORS[category?.dot] || CATEGORY_COLORS.inquiry;
  const status = statusById(item.status);
  const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.IN_PROGRESS;

  return {
    table: {
      widths: [4, "*"],
      body: [[
        { text: "", fillColor: statusColor.bar, border: [false, false, false, false] },
        {
          border: [false, false, false, false],
          margin: [10, 8, 10, 8],
          stack: [
            {
              columns: [
                {
                  width: "*",
                  text: [
                    { text: `${String(item.itemNumber).padStart(2, "0")}  `, color: "#64748b", bold: true, fontSize: 10 },
                    { text: item.title, bold: true, fontSize: 12, color: "#1e293b" },
                  ],
                },
                {
                  width: "auto",
                  table: {
                    body: [[
                      {
                        text: category?.label || item.category,
                        fontSize: 8,
                        bold: true,
                        color: categoryColor.color,
                        fillColor: categoryColor.fill,
                        margin: [6, 3, 6, 3],
                      },
                    ]],
                  },
                  layout: "noBorders",
                },
              ],
            },
            {
              text: [
                { text: `Created ${formatCreated(item.createdAt)}${item.createdByName ? ` by ${item.createdByName}` : ""}`, color: "#64748b", fontSize: 9 },
                { text: "    ", fontSize: 9 },
                { text: status?.label || item.status, color: statusColor.color, bold: true, fontSize: 9 },
              ],
              margin: [0, 4, 0, 4],
            },
            { text: item.details, fontSize: 10, color: "#334155", lineHeight: 1.3 },
          ],
        },
      ]],
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => "#e2e8f0",
      vLineColor: () => "#e2e8f0",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 8],
    unbreakable: true,
  };
}

export function exportFeedbackPdf({ groups, moduleLabel, typeLabel, search }) {
  ensureFonts();
  const generatedAt = new Date();
  const generated = formatGenerated(generatedAt);
  const printableGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.status === "IN_PROGRESS"),
    }))
    .filter((group) => group.items.length > 0);
  const itemCount = printableGroups.reduce((total, group) => total + group.items.length, 0);
  const content = [
    { text: "Smart V2 System Review", fontSize: 22, bold: true, color: "#1e293b", margin: [0, 4, 0, 2] },
    { text: "Issues reported from the new system", fontSize: 11, color: "#64748b", margin: [0, 0, 0, 10] },
    { text: "PREPARED BY", fontSize: 8, bold: true, color: "#64748b", margin: [0, 0, 0, 4] },
    {
      table: {
        widths: ["*", "*"],
        body: [[
          personCell("Mohamed Mohamoud (Eng Sacad)", "Senior Backend Developer, Softway"),
          personCell("Said Hussein (Eng Bulhan)", "Senior Mobile & Backend Developer, Softway"),
        ]],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#e2e8f0",
        vLineColor: () => "#e2e8f0",
      },
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        widths: ["*", "*", "*"],
        body: [[
          scopeCell("Module", moduleLabel),
          scopeCell("Feedback", typeLabel),
          scopeCell("Generated", generated),
        ]],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#e2e8f0",
        vLineColor: () => "#e2e8f0",
      },
      margin: [0, 0, 0, 8],
    },
    {
      text: `${itemCount} in-progress ${itemCount === 1 ? "issue" : "issues"}${search ? ` · Search “${search}”` : ""}`,
      fontSize: 10,
      color: "#64748b",
      margin: [0, 2, 0, 6],
    },
  ];

  printableGroups.forEach((group) => {
    content.push({
      text: group.moduleName,
      fontSize: 14,
      bold: true,
      color: "#2563eb",
      margin: [0, 14, 0, 2],
    });
    content.push({
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: "#dbeafe" }],
      margin: [0, 0, 0, 8],
    });
    group.items.forEach((item) => content.push(itemBlock(item)));
  });

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 58, 40, 46],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    header() {
      return {
        margin: [40, 16, 40, 0],
        stack: [
          {
            columns: [
              { text: "SMART V2", bold: true, color: "#2563eb", fontSize: 11, width: "auto" },
              { text: "Issue report", color: "#64748b", fontSize: 11, margin: [8, 0, 0, 0], width: "*" },
              { text: `Generated ${generated}`, alignment: "right", color: "#1e293b", fontSize: 9, width: "auto" },
            ],
          },
          { canvas: [{ type: "line", x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 2, lineColor: "#2563eb" }] },
        ],
      };
    },
    footer(currentPage, pageCount) {
      return {
        margin: [40, 10, 40, 0],
        columns: [
          { text: "Smart-Remit V2 · Issues reported from the new system", color: "#94a3b8", fontSize: 8 },
          { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#94a3b8", fontSize: 8 },
        ],
      };
    },
    content,
  };

  const filename = `smart-v2-${slug(moduleLabel)}-${slug(typeLabel)}-${fileStamp(generatedAt)}.pdf`;
  return pdfMake.createPdf(docDefinition).download(filename);
}
