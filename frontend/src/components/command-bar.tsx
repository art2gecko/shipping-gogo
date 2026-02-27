import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface CommandBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  filterChips?: FilterChip[];
  selectedCount?: number;
  bulkActions?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}

export function CommandBar({
  search,
  onSearchChange,
  placeholder = "Search...",
  filterChips = [],
  selectedCount = 0,
  bulkActions,
  actions,
  filters,
  className,
}: CommandBarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Unified command bar surface */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9 text-sm bg-background"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => onSearchChange("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Filters */}
          {filters}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          {actions}
        </div>

        {/* Active filters + bulk actions bar */}
        {(filterChips.length > 0 || selectedCount > 0) && (
          <div className="flex items-center gap-2 text-sm mt-2.5 pt-2.5 border-t border-border">
            {selectedCount > 0 && bulkActions && (
              <>
                <span className="text-xs font-medium text-foreground">
                  {selectedCount} selected
                </span>
                <div className="flex items-center gap-1">{bulkActions}</div>
                {filterChips.length > 0 && (
                  <div className="h-4 w-px bg-border mx-1" />
                )}
              </>
            )}
            {filterChips.map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="gap-1 pl-2 pr-1 font-normal cursor-pointer hover:bg-secondary/80"
                onClick={chip.onRemove}
              >
                {chip.label}
                <X className="h-3 w-3" />
              </Badge>
            ))}
            {filterChips.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => filterChips.forEach((c) => c.onRemove())}
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
