import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { API_ENDPOINTS } from "@/config/api";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = router.query.token as string;
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(`${API_ENDPOINTS.users.verifyEmail}?token=${token}`);
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage("✅ Email verification successful! You will be redirected to the login page in a few seconds....");
          setTimeout(() => router.push("/login"), 3000);
        } else {
          setStatus("error");
          setMessage(data.detail || "❌ Authentication failed or token is invalid.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("❌ An error occurred while validating email.");
      }
    };

    verify();
  }, [router.query.token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Email Authentication</h1>
        {status === "pending" && <p>Verifying...</p>}
        {status === "success" && (
          <div>
            <p className="text-green-600 text-lg font-semibold">{message}</p>
            <div className="mt-4">
              <svg className="mx-auto w-16 h-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
        {status === "error" && <p className="text-red-600">{message}</p>}
      </div>
    </div>
  );
} 