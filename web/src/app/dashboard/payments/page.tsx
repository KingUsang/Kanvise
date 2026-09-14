"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Landmark, Wallet, Plus, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EditPayoutModal from "@/components/dashboard/payments/edit-payout-modal";
import { DashboardPageHeader } from "@/components/dashboard/page-header";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const sessionToken = session?.session?.access_token;
      if (!sessionToken) throw new Error("No active session");
      setToken(sessionToken);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        
        // Fetch summary
      const summaryRes = await fetch(`${apiUrl}/payments/summary`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
        
        if (!summaryRes.ok) {
          const errText = await summaryRes.text();
          throw new Error(`Summary API Error (${summaryRes.status}): ${errText}`);
        }
        const summaryData = await summaryRes.json();
        
        // Fetch payments
      const paymentsRes = await fetch(`${apiUrl}/payments`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
        
        if (!paymentsRes.ok) {
          const errText = await paymentsRes.text();
          throw new Error(`Payments API Error (${paymentsRes.status}): ${errText}`);
        }
        const paymentsData = await paymentsRes.json();

        setSummary(summaryData.data);
        setPayments(paymentsData.data);
      } catch (err: any) {
        console.error('Failed to load financials', err);
        setError('We could not load your financial information. Please try again.');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, []);

  const resolveItemName = (payment: any) => {
    if (payment.sub_programmes?.name) return payment.sub_programmes.name;
    if (payment.courses?.name) return payment.courses.name;
    if (payment.programmes?.name) return payment.programmes.name;
    return "Item no longer available";
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "successful":
        return <span className="inline-block px-2 py-1 bg-[#166534]/10 text-[#166534] text-[10px] font-bold uppercase rounded border border-[#166534]/20">Paid</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="animate-spin text-[#180d62] mb-4" size={48} />
        <p className="text-[#474551]">Loading payments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] text-[#ba1a1a] p-6">
        <AlertCircle size={48} className="mb-4" />
        <h2 className="text-xl font-bold mb-2">We could not load your payments</h2>
        <p className="text-center max-w-md bg-[#ba1a1a]/10 p-4 rounded-md text-sm">{error}</p>
      </div>
    );
  }

  const { subaccount, subscription } = summary || {};

  return (
    <div className="flex flex-col gap-6 max-w-[1440px]">
      {/* Page Header */}
      <DashboardPageHeader
        className="border-b border-dashboard-outline pb-4"
        title="Payments"
        description="See student payments, where your money will be sent, and your Kanvise plan."
      />

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Payment Setup Card */}
        <section className="relative col-span-1 flex flex-col overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-dashboard-outline bg-dashboard-surface-subtle p-6 pb-4">
            <div>
              <h3 className="text-[20px] font-semibold text-[#1b1c1c]">Bank account for payouts</h3>
              <p className="text-[12px] font-semibold tracking-wider text-[#474551] mt-1">
                Status: <span className="font-bold text-dashboard-primary">{subaccount ? "Configured" : "Pending Setup"}</span>
              </p>
            </div>
            <Landmark className="text-[#787582]" size={30} />
          </div>
          <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center bg-dashboard-surface p-6 text-center">
            {subaccount ? (
              <>
                <Wallet className="mb-4 text-dashboard-primary opacity-80" size={48} />
                <h4 className="text-[18px] font-bold text-[#1b1c1c] mb-2">Bank account added</h4>
                <p className="text-[14px] text-[#474551] max-w-md mb-6">{subaccount.business_name} - {subaccount.account_number}</p>
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-2 rounded-dashboard-control border border-dashboard-outline bg-dashboard-surface px-6 py-3 text-[12px] font-semibold tracking-wider text-dashboard-foreground shadow-sm transition-colors hover:bg-dashboard-surface-subtle"
                >
                  Change bank details
                </button>
              </>
            ) : (
              <>
                <Wallet className="mb-4 text-dashboard-primary opacity-80" size={48} />
                <h4 className="text-[18px] font-bold text-[#1b1c1c] mb-2">Add the account where you receive payments</h4>
                <p className="text-[14px] text-[#474551] max-w-md mb-6">Student payments cannot be sent to your school until you add a Nigerian bank account.</p>
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-2 rounded-dashboard-control bg-dashboard-primary px-6 py-3 text-[12px] font-semibold tracking-wider text-white shadow-sm transition-colors hover:bg-dashboard-primary/90"
                >
                  <Plus size={18} />
                  Add bank details
                </button>
              </>
            )}
          </div>
        </section>

        {/* Subscription Status Card */}
        <section className="col-span-1 flex flex-col rounded-dashboard-panel bg-dashboard-primary text-white shadow-dashboard-card">
          <div className="p-6 pb-4 border-b border-[#180d62] flex justify-between items-center">
            <h3 className="text-[20px] font-semibold">Kanvise Subscription</h3>
            <BadgeCheck className="text-[#c4c0ff]" size={24} />
          </div>
          <div className="p-6 flex flex-col gap-6 flex-1">
            <div>
              <span className="text-[12px] font-semibold tracking-wider text-[#c4c0ff] block mb-1">Amount paid</span>
              <span className="text-[48px] leading-[56px] tracking-[-0.02em] font-bold">
                {subscription ? `₦${Number(subscription.amount).toLocaleString()}` : "Not started"}
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-[#180d62] pb-2">
                <span className="text-[14px] text-[#c4c0ff]">Status</span>
                <span className="text-[#4ade80] bg-[#4ade80]/10 px-2 py-1 rounded text-[12px] font-semibold capitalize">{subscription?.status || "Inactive"}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#180d62] pb-2">
                <span className="text-[14px] text-[#c4c0ff]">Plan ends</span>
                <span className="text-[14px] font-semibold">{subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "Not available"}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Transaction List Data Table */}
      <section className="mt-8 flex flex-col overflow-hidden rounded-dashboard-panel border border-dashboard-outline bg-dashboard-surface shadow-dashboard-card">
        <div className="flex items-center justify-between border-b border-dashboard-outline bg-dashboard-surface-subtle p-6">
          <div>
            <h3 className="text-[20px] font-semibold text-[#1b1c1c]">Payments received</h3>
            <p className="text-[12px] font-semibold tracking-wider text-[#474551] mt-1">Successful student payments to your school</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="border-b border-dashboard-outline bg-dashboard-surface-subtle">
              <tr>
                <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase">Date</th>
                <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase">Student</th>
                <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase">Item</th>
                <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase text-right">Student paid</th>
                {/* <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase text-right">Kanvise Fee</th> */}
                <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase text-right">Your school receives</th>
                <th className="py-3 px-6 text-[12px] font-semibold tracking-wider text-[#474551] uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#474551]">No successful student payments yet.</td>
                </tr>
              ) : payments.map((payment) => (
                <tr key={payment.id} className="border-b border-dashboard-outline/50 transition-colors hover:bg-dashboard-primary/5">
                  <td className="py-4 px-6 text-[#474551]">{new Date(payment.paid_at || payment.created_at).toLocaleDateString()}</td>
                  <td className="py-4 px-6 font-semibold text-[#1b1c1c]">
                    {payment.user_profiles?.first_name} {payment.user_profiles?.last_name}
                  </td>
                  <td className="py-4 px-6 text-[#474551]">{resolveItemName(payment)}</td>
                  <td className="py-4 px-6 text-right font-medium">₦{payment.amount?.toLocaleString()}</td>
                  {/* <td className="py-4 px-6 text-right text-[#ba1a1a]">₦{payment.kanvise_fee?.toLocaleString()}</td> */}
                  <td className="py-4 px-6 text-right font-semibold text-[#166534]">₦{payment.centre_amount?.toLocaleString()}</td>
                  <td className="py-4 px-6 text-center">
                    {getStatusBadge(payment.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Payout Modal */}
      <EditPayoutModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchData}
        token={token}
      />
    </div>
  );
}
