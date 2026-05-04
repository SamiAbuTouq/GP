"use client";

import { useEffect, useState } from "react";
import { EntityLayout } from "@/components/entity-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type AccessRequest = {
  requestId: number;
  fullName: string;
  email: string;
  department: string;
  maxWorkload: number;
  courses: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  submittedAt: string;
};

export default function AccessRequestsPage() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReasonById, setRejectReasonById] = useState<Record<number, string>>({});
  const [actingId, setActingId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async (nextStatus = status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/access-requests?status=${nextStatus}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load access requests.");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load access requests.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const approve = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/access-requests/${id}/approve`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve request.");
      toast({ title: "Success", description: "Access request approved." });
      await load("PENDING");
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to approve request.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/access-requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReasonById[id] || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject request.");
      toast({ title: "Success", description: "Access request rejected." });
      await load("PENDING");
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to reject request.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  return (
    <EntityLayout
      title="Lecturer Access Requests"
      description="Review self-registration requests from lecturers."
      headerActions={
        <Tabs value={status} onValueChange={(v) => setStatus(v as "PENDING" | "APPROVED" | "REJECTED")}>
          <TabsList>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>{status[0] + status.slice(1).toLowerCase()} Requests ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
          {!loading && rows.length === 0 ? <p className="text-sm text-muted-foreground">No requests found.</p> : null}
          {rows.map((r) => (
            <div key={r.requestId} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.fullName} <span className="text-muted-foreground">({r.email})</span></div>
                <Badge>{r.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Department: {r.department} | Max workload: {r.maxWorkload} | Submitted: {new Date(r.submittedAt).toLocaleString()}
              </p>
              <p className="text-sm">
                Courses: {r.courses.length ? r.courses.join(", ") : "None selected"}
              </p>
              {r.status === "REJECTED" ? (
                <p className="text-sm text-muted-foreground">Reason: {r.rejectionReason || "No reason provided."}</p>
              ) : null}
              {r.status === "PENDING" ? (
                <div className="space-y-2 pt-2">
                  <Textarea
                    placeholder="Optional rejection reason"
                    value={rejectReasonById[r.requestId] ?? ""}
                    onChange={(e) =>
                      setRejectReasonById((prev) => ({ ...prev, [r.requestId]: e.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button disabled={actingId === r.requestId} onClick={() => void approve(r.requestId)}>
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={actingId === r.requestId}
                      onClick={() => void reject(r.requestId)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </EntityLayout>
  );
}
