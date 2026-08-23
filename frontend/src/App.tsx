import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type Email = {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  scheduledAt?: string;
  sentAt?: string;
  status: string;
};

const API_URL = "http://localhost:5000";

function App() {
  const [user, setUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<
    "scheduled" | "sent"
  >("scheduled");

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCompose, setShowCompose] =
    useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [recipients, setRecipients] =
    useState<string[]>([]);

  const [invalidCount, setInvalidCount] =
    useState(0);

  const [duplicateCount, setDuplicateCount] =
    useState(0);

  const [startTime, setStartTime] =
    useState("");

  const [delayBetweenEmails, setDelayBetweenEmails] =
    useState(2000);

  const [hourlyLimit, setHourlyLimit] =
    useState(100);

  const [scheduling, setScheduling] =
    useState(false);

  const [scheduleMessage, setScheduleMessage] =
    useState("");

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user, activeTab]);

  async function fetchUser() {
    try {
      const response = await fetch(
        `${API_URL}/auth/me`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmails() {
    if (!user) return;

    try {
      setLoading(true);

      const endpoint =
        activeTab === "scheduled"
          ? "scheduled"
          : "sent";

      const response = await fetch(
        `${API_URL}/api/emails/${endpoint}?userId=${user.id}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch emails"
        );
      }

      const data = await response.json();

      setEmails(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(error);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    window.location.href =
      `${API_URL}/auth/google`;
  }

  async function logout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(error);
    }

    setUser(null);
    setEmails([]);
  }

  function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const text = String(
        e.target?.result || ""
      );

      const values = text
        .split(/[\n,;]+/)
        .map((value) =>
          value
            .trim()
            .replace(/^["']|["']$/g, "")
        )
        .filter(Boolean);

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const validEmails: string[] = [];
      let invalid = 0;

      for (const value of values) {
        // Ignore common CSV headers
        if (
          value.toLowerCase() ===
            "email" ||
          value.toLowerCase() ===
            "email address"
        ) {
          continue;
        }

        const email = value.toLowerCase();

        if (emailRegex.test(email)) {
          validEmails.push(email);
        } else {
          invalid++;
        }
      }

      const uniqueEmails = [
        ...new Set(validEmails),
      ];

      const duplicates =
        validEmails.length -
        uniqueEmails.length;

      setRecipients(uniqueEmails);
      setInvalidCount(invalid);
      setDuplicateCount(duplicates);
    };

    reader.readAsText(file);
  }

  async function handleSchedule(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!user) return;

    if (!subject.trim()) {
      setScheduleMessage(
        "Please enter a subject."
      );
      return;
    }

    if (!body.trim()) {
      setScheduleMessage(
        "Please enter the email body."
      );
      return;
    }

    if (recipients.length === 0) {
      setScheduleMessage(
        "Please upload a CSV containing valid email addresses."
      );
      return;
    }

    if (!startTime) {
      setScheduleMessage(
        "Please select a start time."
      );
      return;
    }

    const firstTime = new Date(startTime);

    if (firstTime.getTime() <= Date.now()) {
      setScheduleMessage(
        "Please select a future start time."
      );
      return;
    }

    try {
      setScheduling(true);
      setScheduleMessage("");

      for (
        let i = 0;
        i < recipients.length;
        i++
      ) {
        const scheduledAt = new Date(
          firstTime.getTime() +
            i * delayBetweenEmails
        );

        const response = await fetch(
          `${API_URL}/api/emails/schedule`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              recipient: recipients[i],
              subject: subject.trim(),
              body: body.trim(),
              scheduledAt:
                scheduledAt.toISOString(),
              userId: user.id,
              delayBetweenEmails,
              hourlyLimit,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ||
              "Failed to schedule email"
          );
        }
      }

      setScheduleMessage(
        `${recipients.length} email${
          recipients.length !== 1
            ? "s"
            : ""
        } scheduled successfully!`
      );

      setSubject("");
      setBody("");
      setRecipients([]);
      setInvalidCount(0);
      setDuplicateCount(0);
      setStartTime("");
      setDelayBetweenEmails(2000);
      setHourlyLimit(100);

      await fetchEmails();

      setTimeout(() => {
        setShowCompose(false);
        setScheduleMessage("");
      }, 1500);
    } catch (error) {
      console.error(
        "Scheduling error:",
        error
      );

      setScheduleMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while scheduling the emails."
      );
    } finally {
      setScheduling(false);
    }
  }

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-gray-500">
          Loading ReachInbox...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white">
            R
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            ReachInbox
          </h1>

          <p className="mt-2 text-gray-500">
            Email scheduling made simple.
          </p>

          <button
            onClick={login}
            className="mt-8 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              R
            </div>

            <div>
              <h1 className="font-bold text-gray-900">
                ReachInbox
              </h1>

              <p className="text-xs text-gray-500">
                Email Scheduler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user.avatar && (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-10 w-10 rounded-full"
              />
            )}

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user.name}
              </p>

              <p className="text-xs text-gray-500">
                {user.email}
              </p>
            </div>

            <button
              onClick={logout}
              className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Email Dashboard
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Manage your scheduled and sent emails.
            </p>
          </div>

          <button
            onClick={() => {
              setShowCompose(true);
              setScheduleMessage("");
            }}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            + Compose New Email
          </button>
        </div>

        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() =>
              setActiveTab("scheduled")
            }
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === "scheduled"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500"
            }`}
          >
            Scheduled Emails
          </button>

          <button
            onClick={() =>
              setActiveTab("sent")
            }
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === "sent"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500"
            }`}
          >
            Sent Emails
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading emails...
            </div>
          ) : emails.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-medium text-gray-700">
                No emails found
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Your {activeTab} emails will appear
                here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-600">
                      Recipient
                    </th>

                    <th className="px-6 py-4 font-semibold text-gray-600">
                      Subject
                    </th>

                    <th className="px-6 py-4 font-semibold text-gray-600">
                      {activeTab === "scheduled"
                        ? "Scheduled Time"
                        : "Sent Time"}
                    </th>

                    <th className="px-6 py-4 font-semibold text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {emails.map((email) => (
                    <tr
                      key={email.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        {email.recipient}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {email.subject}
                      </td>

                      <td className="px-6 py-4 text-gray-500">
                        {new Date(
                          activeTab ===
                          "scheduled"
                            ? email.scheduledAt!
                            : email.sentAt!
                        ).toLocaleString()}
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                          {email.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Compose New Email
                </h2>

                <p className="text-sm text-gray-500">
                  Schedule emails to your leads.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowCompose(false)
                }
                className="text-2xl text-gray-400"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSchedule}
              className="space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Subject
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  placeholder="Enter email subject"
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Email Body
                </label>

                <textarea
                  value={body}
                  onChange={(e) =>
                    setBody(e.target.value)
                  }
                  placeholder="Write your email..."
                  rows={6}
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Upload Leads CSV
                </label>

                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="w-full rounded-lg border p-3"
                />

                {recipients.length > 0 && (
                  <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    <p className="font-medium">
                      ✓ {recipients.length} valid
                      email
                      {recipients.length !== 1
                        ? "s"
                        : ""}{" "}
                      detected
                    </p>

                    {invalidCount > 0 && (
                      <p className="mt-1 text-xs">
                        {invalidCount} invalid
                        entr
                        {invalidCount === 1
                          ? "y"
                          : "ies"}{" "}
                        ignored
                      </p>
                    )}

                    {duplicateCount > 0 && (
                      <p className="mt-1 text-xs">
                        {duplicateCount} duplicate
                        {duplicateCount === 1
                          ? ""
                          : "s"}{" "}
                        removed
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Start Time
                </label>

                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) =>
                    setStartTime(e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Delay Between Emails
                  </label>

                  <select
                    value={delayBetweenEmails}
                    onChange={(e) =>
                      setDelayBetweenEmails(
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border px-4 py-3"
                  >
                    <option value={2000}>
                      2 seconds
                    </option>

                    <option value={5000}>
                      5 seconds
                    </option>

                    <option value={10000}>
                      10 seconds
                    </option>

                    <option value={30000}>
                      30 seconds
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Hourly Limit
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={hourlyLimit}
                    onChange={(e) =>
                      setHourlyLimit(
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border px-4 py-3"
                  />
                </div>
              </div>

              {recipients.length > 0 &&
                startTime && (
                  <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
                    <p>
                      <strong>
                        {recipients.length}
                      </strong>{" "}
                      emails will be scheduled.
                    </p>

                    <p>
                      First email:{" "}
                      {new Date(
                        startTime
                      ).toLocaleString()}
                    </p>

                    <p>
                      Delay:{" "}
                      {delayBetweenEmails /
                        1000}{" "}
                      seconds
                    </p>

                    <p>
                      Hourly limit:{" "}
                      {hourlyLimit}
                    </p>
                  </div>
                )}

              {scheduleMessage && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  {scheduleMessage}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowCompose(false)
                  }
                  className="rounded-lg border px-5 py-3"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={scheduling}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  {scheduling
                    ? "Scheduling..."
                    : "Schedule Emails"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;