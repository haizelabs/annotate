import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  Row,
  RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { twMerge } from "tailwind-merge";

const NUM_LOADING_ROWS = 5;

interface Pagination {
  pageIndex: number;
  pageSize: number;
}

export interface CellWrapperComponentProps<TData> extends React.PropsWithChildren {
  row: Row<TData>;
}

function LoadingRows<TData, TValue>({
  columns,
  showCellBorders,
  loadingRef,
}: {
  columns: ColumnDef<TData, TValue>[];
  showCellBorders: boolean;
  loadingRef?: React.RefObject<HTMLTableSectionElement>;
}) {
  return (
    <TableBody ref={loadingRef}>
      {Array.from(Array(NUM_LOADING_ROWS)).map((_, i) => (
        <TableRow key={i}>
          {columns.map((_, j) => (
            <TableCell
              className={cn(
                "h-12",
                i === 0 && "border-t",
                i < NUM_LOADING_ROWS - 1 && "border-b",
                showCellBorders && "border-r"
              )}
              key={j}
            >
              <Skeleton className="w-full h-6" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[] | undefined;
  showPagination?: boolean;
  rowSelection?: RowSelectionState | null;
  handleRowClick?: (row: Row<TData>) => void;
  setRowSelection?: OnChangeFn<RowSelectionState>;
  className?: string | undefined;
  isPending?: boolean;
  error?: Error | null;
  showBorder?: boolean;
  getId?: (row: TData, index: number, parent?: Row<TData>) => string;
  enableRowSelection?: (row: Row<TData>) => boolean;
  initialExpanded?: boolean;
  pageSize?: number;
  showLoading?: boolean;
  loadingRef?: React.RefObject<HTMLTableSectionElement>;
  usePagination?: boolean;
  enableMultiRowSelection?: boolean;
  getRowClassName?: (row: Row<TData>) => string;
  cellClassName?: string;
  hasPermissions?: boolean;
  CellWrapperComponent?: (props: CellWrapperComponentProps<TData>) => React.JSX.Element;
  getSubRows?: (row: TData) => TData[] | undefined;
  onMouseTableEnter?: (e: React.MouseEvent<HTMLTableElement>) => void;
  onMouseTableLeave?: (e: React.MouseEvent<HTMLTableElement>) => void;
  onMouseRowEnter?: (e: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void;
  onMouseRowLeave?: (e: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void;
  showCellBorders?: boolean;
}

function _DataTable<TData, TValue>({
  columns,
  data,
  getId,
  showPagination = false,
  rowSelection = null,
  pagination,
  setPagination,
  showBorder = true,
  setRowSelection,
  handleRowClick,
  enableRowSelection = () => true,
  initialExpanded,
  className,
  showLoading = false,
  loadingRef,
  usePagination = true,
  enableMultiRowSelection = true,
  getRowClassName,
  CellWrapperComponent,
  cellClassName,
  getSubRows,
  onMouseTableEnter,
  onMouseTableLeave,
  onMouseRowEnter,
  onMouseRowLeave,
  showCellBorders = false,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  showPagination?: boolean;
  rowSelection?: RowSelectionState | null;
  pagination: Pagination;
  setPagination: (_: Pagination) => void;
  handleRowClick?: (row: Row<TData>) => void;
  setRowSelection?: OnChangeFn<RowSelectionState>;
  className?: string | undefined;
  showBorder?: boolean;
  getId?: (row: TData, index: number, parent?: Row<TData>) => string;
  enableRowSelection?: (row: Row<TData>) => boolean;
  initialExpanded?: boolean;
  loadingRef?: React.RefObject<HTMLTableSectionElement>;
  usePagination?: boolean;
  showLoading?: boolean;
  enableMultiRowSelection?: boolean;
  getRowClassName?: (row: Row<TData>) => string;
  getSubRows?: (row: TData) => TData[] | undefined;
  CellWrapperComponent?: (props: CellWrapperComponentProps<TData>) => React.JSX.Element;
  cellClassName?: string;
  onMouseTableEnter?: (e: React.MouseEvent<HTMLTableElement>) => void;
  onMouseTableLeave?: (e: React.MouseEvent<HTMLTableElement>) => void;
  onMouseRowEnter?: (e: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void;
  onMouseRowLeave?: (e: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void;
  showCellBorders?: boolean;
}) {
  const [expanded, setExpanded] = React.useState<ExpandedState>(initialExpanded || {});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) =>
      getSubRows !== undefined
        ? getSubRows(row)
        : typeof row === "object" && row !== null && "children" in row
          ? // no-dd-sa
            (row as any).children // eslint-disable-line  @typescript-eslint/no-explicit-any
          : undefined,
    // getRowCanExpand: (row) => "children" in row,
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: false,
    defaultColumn: {
      // @ts-expect-error doing this for column resizing
      size: "auto",
      // size: 200, //starting column size
      // minSize: 50, //enforced during column resizing
      // maxSize: 100, //enforced during column resizing
    },
    getPaginationRowModel: usePagination ? getPaginationRowModel() : undefined,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    enableMultiRowSelection,
    // @ts-expect-error ignore
    getRowId: getId ?? ((row) => ("id" in row ? row.id : undefined)),
    enableRowSelection,
    state: {
      rowSelection: rowSelection ?? {},
      pagination,
      expanded,
    },
  });

  const nextPage = () => {
    if (table.getCanNextPage()) {
      table.nextPage();
      setPagination({ ...pagination, pageIndex: pagination.pageIndex + 1 });
    }
  };

  const previousPage = () => {
    if (table.getCanPreviousPage()) {
      table.previousPage();
      setPagination({ ...pagination, pageIndex: pagination.pageIndex - 1 });
    }
  };

  return (
    <div className={cn("h-full flex flex-col overflow-hidden rounded-md", showBorder && "border", className)}>
      <div className={cn("h-full overflow-auto", showPagination && "border-b")}>
        <Table
          className="h-full border-separate border-spacing-0"
          onMouseEnter={onMouseTableEnter}
          onMouseLeave={onMouseTableLeave}
        >
          <TableHeader className="sticky top-0 bg-white z-10">
            {table.getHeaderGroups().map((headerGroup, tg) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header, i) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-nowrap",
                        tg === table.getHeaderGroups().length - 1 && "border-b",
                        i < headerGroup.headers.length - 1 && showCellBorders && "border-r"
                      )}
                      colSpan={header.colSpan}
                      style={{
                        minWidth: header.column.columnDef.minSize ?? "auto",
                        maxWidth: header.column.columnDef.maxSize ?? "auto",
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length > 0 &&
              table.getRowModel().rows.map((row, i) => (
                <TableRow
                  className={cn("text-nowrap hover:cursor-pointer", getRowClassName?.(row))}
                  onClick={() => {
                    handleRowClick?.(row);
                  }}
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onMouseEnter={(e) => onMouseRowEnter?.(e, row)}
                  onMouseLeave={(e) => onMouseRowLeave?.(e, row)}
                >
                  {row.getVisibleCells().map((cell, j) => {
                    let cellContent = flexRender(cell.column.columnDef.cell, cell.getContext());

                    if (CellWrapperComponent) {
                      cellContent = <CellWrapperComponent row={row}>{cellContent}</CellWrapperComponent>;
                    }

                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          i < table.getRowModel().rows.length - 1 && "border-b",
                          j < row.getVisibleCells().length - 1 && showCellBorders && "border-r",
                          cellClassName
                        )}
                        style={{
                          minWidth: cell.column.columnDef.minSize ?? "auto",
                          maxWidth: cell.column.columnDef.maxSize ?? "auto",
                        }}
                      >
                        {cellContent}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            {table.getRowModel().rows?.length === 0 && !showLoading && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {showLoading && <LoadingRows columns={columns} showCellBorders={showCellBorders} loadingRef={loadingRef} />}
        </Table>
      </div>
      {showPagination && (
        <div className="flex-1 flex items-center gap-4 py-4 px-4">
          <div className="space-x-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
          <p className="text-sm font-semibold">
            Page {pagination.pageIndex + 1} of {table.getPageCount() === 0 ? "1" : table.getPageCount()}
          </p>
        </div>
      )}
    </div>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  getId,
  showPagination = false,
  error = null,
  rowSelection = null,
  handleRowClick,
  setRowSelection,
  enableRowSelection = () => true,
  className = "",
  isPending = false,
  showBorder = true,
  initialExpanded,
  pageSize = 40,
  usePagination = true,
  enableMultiRowSelection = true,
  loadingRef,
  showLoading,
  getRowClassName,
  hasPermissions = true,
  CellWrapperComponent,
  cellClassName,
  getSubRows,
  onMouseTableEnter,
  onMouseTableLeave,
  onMouseRowEnter,
  onMouseRowLeave,
  showCellBorders = false,
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = useState<Pagination>({
    pageIndex: 0,
    pageSize: pageSize,
  });

  if (isPending) {
    return (
      <div className={twMerge(showBorder && "border", "rounded-md")}>
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {columns.map((e, i) => {
                return (
                  <TableHead key={i}>
                    <Skeleton className="w-full h-6" />
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <LoadingRows columns={columns} showCellBorders={showCellBorders} />
        </Table>
      </div>
    );
  }

  if (error || !hasPermissions) {
    return (
      <Table>
        <TableBody className="bg-red-50 w-full p-8 rounded-md">
          <TableRow className="w-full">
            <TableCell className="h-48 w-full font-semibold flex justify-center items-center" colSpan={2}>
              {error ? `Error Loading Data: ${error.message}` : "You do not have permissions to view this"}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <_DataTable
      columns={columns}
      data={data!}
      handleRowClick={handleRowClick}
      enableRowSelection={enableRowSelection}
      pagination={pagination}
      setPagination={setPagination}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      className={className}
      showPagination={showPagination}
      showBorder={showBorder}
      getId={getId}
      initialExpanded={initialExpanded}
      usePagination={usePagination}
      loadingRef={loadingRef}
      showLoading={showLoading}
      enableMultiRowSelection={enableMultiRowSelection}
      getRowClassName={getRowClassName}
      CellWrapperComponent={CellWrapperComponent}
      cellClassName={cellClassName}
      getSubRows={getSubRows}
      onMouseTableEnter={onMouseTableEnter}
      onMouseTableLeave={onMouseTableLeave}
      onMouseRowEnter={onMouseRowEnter}
      onMouseRowLeave={onMouseRowLeave}
      showCellBorders={showCellBorders}
    />
  );
}

export default DataTable;
