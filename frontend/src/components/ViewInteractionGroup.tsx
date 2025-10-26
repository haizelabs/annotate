import { DataTable } from "@/components/Datatable";
import { Interaction, InteractionGroup } from "@/types/interactions";
import { ColumnDef } from "@tanstack/react-table";
import React from "react";

const columns: ColumnDef<Interaction>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      return <div>{row.original.id}</div>;
    },
  },
];

const ViewInteractionGroup = ({
  interactionGroup,
  setSelectedInteraction,
}: {
  interactionGroup: InteractionGroup;
  setSelectedInteraction: (interaction: Interaction) => void;
}) => {
  const interactions = interactionGroup.interactions;
  return (
    <div className="p-4 border">
      <DataTable columns={columns} data={interactions} handleRowClick={(row) => setSelectedInteraction(row.original)} />
    </div>
  );
};

export default ViewInteractionGroup;
