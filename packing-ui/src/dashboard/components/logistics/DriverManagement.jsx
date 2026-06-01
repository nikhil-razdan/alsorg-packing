import {
  useEffect,
  useState,
} from "react";

import LogisticsPagination from "./LogisticsPagination";

import {
  fetchDrivers,
  deleteDriver,
} from "../../api/logisticsApi";

import CreateDriverModal from "./modals/CreateDriverModal";

function DriverManagement() {
  const [drivers, setDrivers] =
    useState([]);

	const [pageNo, setPageNo] =
	  useState(1);

	const [pageSize, setPageSize] =
	  useState(25);
	  
  const [open, setOpen] =
    useState(false);

  const loadDrivers =
    async () => {
      try {
        const data =
          await fetchDrivers();

        setDrivers(data || []);
      } catch (e) {
        console.error(e);
      }
    };

  useEffect(() => {
    const load = async () => {
      try {
        const data =
          await fetchDrivers();

        setDrivers(data || []);
      } catch (e) {
        console.error(e);
      }
    };

    load();
  }, []);

  const remove = async (id) => {
    try {
      await deleteDriver(id);

      loadDrivers();

    } catch (e) {
      console.error(e);

      alert(e.message);
    }
  };

  const paginatedDrivers =
    drivers.slice(
      (pageNo - 1) * pageSize,
      pageNo * pageSize
    );
	
  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={title}>
            Driver Management
          </div>

          <div style={subtitle}>
            Driver operations and
            status
          </div>
        </div>

        <button
          style={button}
          onClick={() =>
            setOpen(true)
          }
        >
          + Add Driver
        </button>
      </div>

      <div style={table}>
        <div style={head}>
          <div>Name</div>

          <div>Phone</div>

          <div>License</div>

          <div>Status</div>

          <div>Actions</div>
        </div>

        {paginatedDrivers.map((d) => (
          <div
            key={d.id}
            style={row}
          >
            <div>{d.name}</div>

			<div>{d.phoneNumber}</div>
			<div>
			             {d.licenseNumber}
			           </div>
			<div>
			  {d.active
			    ? "ACTIVE"
			    : "INACTIVE"}
			</div>
            <div>
              <button
                style={deleteBtn}
                onClick={() =>
                  remove(d.id)
                }
              >
                Delete
              </button>
            </div>
          </div>
        ))}
		</div>

		<LogisticsPagination
		  pageNo={pageNo}
		  setPageNo={setPageNo}
		  pageSize={pageSize}
		  setPageSize={setPageSize}
		  totalItems={drivers.length}
		/>

		<CreateDriverModal
        open={open}
        onClose={() =>
          setOpen(false)
        }
        onCreated={loadDrivers}
      />
    </div>
  );
}

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",

  borderRadius: 24,

  padding: 24,
};

const header = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  marginBottom: 24,
};

const title = {
  color: "#fff",

  fontSize: 24,

  fontWeight: 800,
};

const subtitle = {
  color: "#94a3b8",

  marginTop: 6,
};

const button = {
  height: 44,

  padding: "0 18px",

  borderRadius: 12,

  border: "none",

  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  color: "#fff",

  fontWeight: 700,

  cursor: "pointer",
};

const table = {
  borderRadius: 18,

  overflow: "hidden",
};

const head = {
  display: "grid",

  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr .7fr",

  padding: 16,

  background: "#111827",

  color: "#94a3b8",

  fontWeight: 700,
};

const row = {
  display: "grid",

  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr .7fr",

  padding: 16,

  color: "#fff",

  borderTop:
    "1px solid rgba(255,255,255,0.06)",
};

const deleteBtn = {
  border: "none",

  background: "#ef4444",

  color: "#fff",

  borderRadius: 8,

  padding: "6px 10px",

  cursor: "pointer",

  fontWeight: 700,
};

export default DriverManagement;