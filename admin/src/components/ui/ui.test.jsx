import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Dialog, { ConfirmDialog } from "./Dialog.jsx";
import DataTable, { Pagination } from "./DataTable.jsx";
import BarChart from "./BarChart.jsx";
import { Button, Field, Input } from "./basics.jsx";

// Plan task AD-16: the shared pieces behave the same wherever they are used.

function Opener({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      {children(open, () => setOpen(false))}
    </>
  );
}

describe("Dialog", () => {
  it("is announced as a dialog with its title, and closes on Esc, handing focus back", async () => {
    const user = userEvent.setup();
    render(
      <Opener>
        {(open, close) => (
          <Dialog open={open} title="Change plan" onClose={close}>
            <input aria-label="Reason" />
          </Dialog>
        )}
      </Opener>
    );

    await user.click(screen.getByRole("button", { name: "Open it" }));
    const dialog = screen.getByRole("dialog", { name: "Change plan" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open it" })).toHaveFocus();
  });

  it("keeps the keyboard inside it", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open title="Suspend" onClose={() => {}} footer={<Button>Last</Button>}>
        <input aria-label="First" data-autofocus />
      </Dialog>
    );

    expect(screen.getByLabelText("First")).toHaveFocus();
    await user.tab(); // Last
    await user.tab(); // wraps round to the Close button at the top
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("starts a confirmation on Cancel, so Enter by habit does nothing that cannot be undone", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Delete the draft?" confirmText="Delete the draft" tone="danger" onConfirm={onConfirm} onCancel={onCancel}>
        This cannot be undone.
      </ConfirmDialog>
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete the draft" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not close while it is busy saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open busy title="Saving" onClose={onClose}>
        <p>Working</p>
      </Dialog>
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const table = (props) =>
  render(
    <MemoryRouter initialEntries={["/users"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <DataTable
                label="Users"
                columns={[
                  { key: "name", header: "Account", sort: "name", render: (row) => <a href={`/users/${row.id}`}>{row.name}</a> },
                  { key: "plan", header: "Plan", render: (row) => row.plan },
                ]}
                rowTo={(row) => `/users/${row.id}`}
                {...props}
              />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe("DataTable", () => {
  const rows = [
    { id: "a1", name: "Asha Rao", plan: "Pro" },
    { id: "b2", name: "Vikram Shah", plan: "Free" },
  ];

  it("shows its rows, and opens one when it is clicked anywhere", async () => {
    const user = userEvent.setup();
    table({ rows });
    const body = within(screen.getByRole("table", { name: "Users" }));
    expect(body.getAllByRole("row")).toHaveLength(3);

    await user.click(body.getByText("Free"));
    expect(screen.getByTestId("where")).toHaveTextContent("/users/b2");
  });

  it("says so when there is nothing to show", () => {
    table({ rows: [], empty: "No account matches." });
    expect(screen.getByText("No account matches.")).toBeInTheDocument();
  });

  it("shows grey rows, not an empty table, while it loads for the first time", () => {
    table({ rows: undefined, loading: true });
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Nothing to show.")).not.toBeInTheDocument();
  });

  it("says what went wrong, with a way to try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    table({ rows: undefined, error: "The server cannot be reached.", onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("The server cannot be reached.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("sorts by a heading, newest or largest first, then the other way", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    table({ rows, sort: "name", order: "desc", onSort });

    expect(screen.getByRole("columnheader", { name: /Account/ })).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: /Account/ }));
    expect(onSort).toHaveBeenCalledWith("name", "asc");
  });
});

describe("Pagination", () => {
  it("says where you are and moves a page at a time", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(<Pagination page={2} pageSize={25} total={60} onPage={onPage} />);

    expect(screen.getByText("26 to 50 of 60")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPage.mock.calls).toEqual([[3], [1]]);
  });

  it("stops at the first and last page", () => {
    render(<Pagination page={1} pageSize={25} total={10} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("Field", () => {
  it("names its control by the label alone, and describes it with the help or the error", () => {
    const { rerender } = render(
      <Field label="Admin key" help="Set on the server.">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("Admin key");
    expect(input).toHaveAccessibleDescription("Set on the server.");

    rerender(
      <Field label="Admin key" help="Set on the server." error="This is needed.">
        <Input />
      </Field>
    );
    expect(input).toHaveAccessibleDescription("This is needed.");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

describe("BarChart", () => {
  const data = [
    { key: "2026-10-09", label: "9 Oct", value: 3 },
    { key: "2026-10-10", label: "10 Oct", value: 0 },
    { key: "2026-10-11", label: "11 Oct", value: 7 },
  ];

  it("can be read with the arrow keys alone", async () => {
    const user = userEvent.setup();
    render(<BarChart label="Documents completed" data={data} />);

    const chart = screen.getByRole("group", { name: /Documents completed, by day: 10 in all/ });
    chart.focus();
    await user.keyboard("{ArrowRight}");
    expect(chart).toHaveTextContent("9 Oct: 3");
    await user.keyboard("{End}");
    expect(chart).toHaveTextContent("11 Oct: 7");
  });

  it("lists every value as a table on request", async () => {
    const user = userEvent.setup();
    render(<BarChart label="Money received" data={data} format={(n) => `Rs. ${n}`} />);

    await user.click(screen.getByRole("button", { name: "Show as table" }));
    const rowsShown = within(screen.getByRole("table")).getAllByRole("row");
    expect(rowsShown.map((row) => row.textContent)).toEqual(["DayMoney received", "9 OctRs. 3", "10 OctRs. 0", "11 OctRs. 7"]);
  });
});
