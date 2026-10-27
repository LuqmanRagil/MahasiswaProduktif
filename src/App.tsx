import { lazy, Suspense } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createHashRouter, createMemoryRouter, RouterProvider, Outlet } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/AuthProvider";
import { GuestOnly, RequireAuth, RequireOnboarded } from "@/auth/guards";
import { AppLayout } from "@/components/layout/AppLayout";
import { QuickActionsProvider } from "@/features/quick/QuickActions";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoadingState } from "@/components/ui/states";

// Halaman dimuat saat dibuka (ukuran unduhan awal lebih kecil di HP).
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const TasksPage = lazy(() => import("@/pages/TasksPage").then((m) => ({ default: m.TasksPage })));
const CoursesPage = lazy(() => import("@/pages/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const CourseDetailPage = lazy(() => import("@/pages/CourseDetailPage").then((m) => ({ default: m.CourseDetailPage })));
const FinancePage = lazy(() => import("@/pages/finance/FinancePage").then((m) => ({ default: m.FinancePage })));
const BudgetPage = lazy(() => import("@/pages/finance/BudgetPage").then((m) => ({ default: m.BudgetPage })));
const TransactionsPage = lazy(() => import("@/pages/finance/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const CalendarPage = lazy(() => import("@/pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const GpaPage = lazy(() => import("@/pages/GpaPage").then((m) => ({ default: m.GpaPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
  queryCache: new QueryCache({
    onError: (err) => console.error("[query]", err),
  }),
});

function Providers() {
  return (
    <AuthProvider>
      <QuickActionsProvider>
        <Suspense fallback={<LoadingState className="min-h-[60dvh]" />}>
          <Outlet />
        </Suspense>
      </QuickActionsProvider>
    </AuthProvider>
  );
}

const routes = [
  {
    element: <Providers />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: "/masuk", element: <LoginPage /> },
          { path: "/daftar", element: <RegisterPage /> },
          { path: "/lupa-password", element: <ForgotPasswordPage /> },
        ],
      },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/onboarding", element: <OnboardingPage /> },
          {
            element: <RequireOnboarded />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  { path: "/", element: <DashboardPage /> },
                  { path: "/tugas", element: <TasksPage /> },
                  { path: "/mata-kuliah", element: <CoursesPage /> },
                  { path: "/mata-kuliah/:id", element: <CourseDetailPage /> },
                  { path: "/ipk", element: <GpaPage /> },
                  { path: "/keuangan", element: <FinancePage /> },
                  { path: "/keuangan/anggaran", element: <BudgetPage /> },
                  { path: "/keuangan/transaksi", element: <TransactionsPage /> },
                  { path: "/kalender", element: <CalendarPage /> },
                  { path: "/pengaturan", element: <SettingsPage /> },
                  { path: "*", element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Build normal memakai URL biasa. Preview satu-file memakai router memori (tanpa server),
// opsi "hash" tersedia untuk dibuka langsung dari file.
const mode = import.meta.env.VITE_ROUTER;
const router = mode === "memory" ? createMemoryRouter(routes) : mode === "hash" ? createHashRouter(routes) : createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
    </QueryClientProvider>
  );
}
