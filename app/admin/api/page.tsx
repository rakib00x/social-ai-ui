import { Suspense } from "react";
import ApiIntegrationClient from "./ApiIntegrationClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ApiIntegrationClient />
    </Suspense>
  );
}
