import * as React from "react";
import { Download, FileText, FolderOpen, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/data-table";
import { TableSkeleton } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";
import { useDocuments, useSettings } from "@/hooks/use-api";
import { documents as docsApi } from "@/lib/api";
import { formatDateTime, todayISO } from "@/lib/utils";
import type { Document as DocType, DocumentType } from "@/types";

const DOC_TYPES: DocumentType[] = ["PICK_LIST", "PACKING_SLIP", "LABEL", "MANIFEST", "EXPORT"];

const docTypeLabels: Record<DocumentType, string> = {
  PICK_LIST: "Pick List",
  PACKING_SLIP: "Packing Slip",
  LABEL: "Label",
  MANIFEST: "Manifest",
  EXPORT: "Export",
};

const docTypeColors: Record<DocumentType, "default" | "secondary" | "outline" | "success" | "warning"> = {
  PICK_LIST: "default",
  PACKING_SLIP: "secondary",
  LABEL: "success",
  MANIFEST: "warning",
  EXPORT: "outline",
};

export default function DocumentsPage() {
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const { data: docs, isLoading } = useDocuments();
  const { data: settingsList } = useSettings();

  const shipmentRoot = settingsList?.find((s) => s.key === "shipment_root")?.value;

  const filtered = React.useMemo(() => {
    if (!docs) return [];
    let list = docs;
    if (typeFilter !== "all") list = list.filter((d) => d.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.fileName.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q),
      );
    }
    return list;
  }, [docs, typeFilter, search]);

  const columns: Column<DocType>[] = [
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (d) => (
        <Badge variant={docTypeColors[d.type] || "outline"}>
          {docTypeLabels[d.type] || d.type}
        </Badge>
      ),
    },
    {
      key: "fileName",
      header: "File Name",
      sortable: true,
      render: (d) => <span className="font-medium text-sm">{d.fileName}</span>,
    },
    {
      key: "mimeType",
      header: "Format",
      render: (d) => (
        <span className="text-xs text-muted-foreground">
          {d.mimeType === "application/pdf"
            ? "PDF"
            : d.mimeType === "text/csv"
              ? "CSV"
              : d.mimeType}
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.sizeBytes ? `${(d.sizeBytes / 1024).toFixed(1)} KB` : "-"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      render: (d) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(d.createdAt)}</span>
      ),
    },
    {
      key: "download",
      header: "",
      className: "w-12",
      render: (d) => (
        <a
          href={docsApi.downloadUrl(d.id)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Generated pick lists, packing slips, labels, and manifests
          </p>
        </div>
        {shipmentRoot && (
          <Button variant="outline" onClick={() => {
            toast({ title: "Shipment Folder", description: `${shipmentRoot}/${todayISO()}` });
          }}>
            <FolderOpen className="h-4 w-4" />
            Today's Folder
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {docTypeLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="Documents will appear here as they are generated."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(d) => d.id}
          pageSize={20}
        />
      )}
    </div>
  );
}

