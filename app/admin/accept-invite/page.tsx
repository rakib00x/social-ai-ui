import { Suspense } from "react";
import Client from "./AcceptInviteClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Client />
    </Suspense>
  );
}
