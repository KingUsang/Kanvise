"use client";

import { useState, useEffect } from "react";
import { Loader2, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface Bank {
  id: number;
  name: string;
  code: string;
}

interface EditPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}

export default function EditPayoutModal({ isOpen, onClose, onSuccess, token }: EditPayoutModalProps) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchBanks = async () => {
      setLoadingBanks(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${apiUrl}/payments/banks`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load banks");
        setBanks(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingBanks(false);
      }
    };
    fetchBanks();
  }, [isOpen, token]);

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      const resolveAccount = async () => {
        setResolving(true);
        setAccountName("");
        setError(null);
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          const res = await fetch(`${apiUrl}/payments/subaccount/resolve`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not resolve account");
          setAccountName(data.data.account_name);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setResolving(false);
        }
      };
      resolveAccount();
    } else {
      setAccountName("");
    }
  }, [accountNumber, bankCode, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !accountNumber || !bankCode) {
      setError("Please ensure account details are verified.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/payments/subaccount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          business_name: accountName,
          account_number: accountNumber,
          bank_code: bankCode
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save payout account");
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1c1c]/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-[#C2B59B] bg-[#fbf9f8]">
          <h2 className="text-[20px] font-semibold text-[#1b1c1c]">Configure Payout Account</h2>
          <button onClick={onClose} className="text-[#474551] hover:text-[#1b1c1c]">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 rounded text-[#ba1a1a] text-[12px] flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#474551] mb-2 uppercase tracking-wider">
              Bank
            </label>
            <div className="relative">
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full border border-[#c8c5d2] rounded px-4 py-3 text-[14px] text-[#1b1c1c] focus:outline-none focus:border-[#180d62] appearance-none bg-white disabled:bg-gray-50"
                disabled={loadingBanks || submitting}
              >
                <option value="">Select your bank</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
              {loadingBanks && (
                <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#474551]" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#474551] mb-2 uppercase tracking-wider">
              Account Number
            </label>
            <input
              type="text"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="0123456789"
              className="w-full border border-[#c8c5d2] rounded px-4 py-3 text-[14px] text-[#1b1c1c] focus:outline-none focus:border-[#180d62] disabled:bg-gray-50"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#474551] mb-2 uppercase tracking-wider">
              Account Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={accountName}
                readOnly
                placeholder="Verified automatically"
                className={`w-full border ${accountName ? "border-[#166534]" : "border-[#c8c5d2]"} bg-gray-50 rounded px-4 py-3 text-[14px] text-[#1b1c1c] focus:outline-none`}
              />
              {resolving && (
                <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#180d62]" />
              )}
              {accountName && !resolving && (
                <CheckCircle2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#166534]" />
              )}
            </div>
            <p className="text-[12px] text-[#474551] mt-2">
              We verify this name with Paystack to ensure funds are sent to the correct account.
            </p>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#c8c5d2] text-[#474551] rounded text-[14px] font-semibold hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!accountName || submitting}
              className="flex-1 px-4 py-3 bg-[#994704] text-white rounded text-[14px] font-semibold hover:bg-[#ff9653] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Save Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
