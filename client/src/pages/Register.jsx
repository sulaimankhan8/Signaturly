import { useState } from "react";
import { registerApi } from "../api/auth.api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();

  const submit = async () => {
    if (!form.name || !form.email || !form.password) {
      alert("All fields are required");
      return;
    }

    try {
      await registerApi(form);
      navigate("/login");
    } catch (err) {
      console.error("Registration error:", err.response?.data || err);
      alert(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div>
      <input
        placeholder="Name"
        value={form.name}
        onChange={(e) =>
          setForm({ ...form, name: e.target.value })
        }
      />

      <input
        placeholder="Email"
        value={form.email}
        onChange={(e) =>
          setForm({ ...form, email: e.target.value })
        }
      />

      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
      />

      <button onClick={submit}>Register</button>
    </div>
  );
}
