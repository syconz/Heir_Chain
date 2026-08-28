import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Home       from "./pages/Home";
import Dashboard  from "./pages/Dashboard";
import CreateWill from "./pages/CreateWill";
import GuardianVote from "./pages/GuardianVote";
import HeirPortal from "./pages/HeirPortal";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index           element={<Home />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="create"     element={<CreateWill />} />
          <Route path="guardian"   element={<GuardianVote />} />
          <Route path="heir"       element={<HeirPortal />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
