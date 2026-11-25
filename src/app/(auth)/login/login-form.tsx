"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/server/auth-actions";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui-client";

const demoAccounts = [
  { email: "admin@cmms.local", name: "陈益磊", role: "系统管理员" },
  { email: "manager@cmms.local", name: "王主管", role: "维修主管" },
  { email: "tech1@cmms.local", name: "李师傅", role: "维修工程师" },
];

export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  const [email, setEmail] = useState(showDemo ? "admin@cmms.local" : "");
  const [password, setPassword] = useState(showDemo ? "admin123" : "");

  return (
    <>
      <form action={action} className="mt-7 space-y-4">
        <input type="hidden" name="next" value={next ?? "/app/dashboard"} />
        <Field label="邮箱" required>
          <Input
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@cmms.local"
            required
          />
        </Field>
        <Field label="密码" required>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            required
          />
        </Field>

        {state?.error && (
          <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
            <WarningCircle className="size-4 shrink-0" />
            {state.error}
          </p>
        )}

        <SubmitButton className="mt-1 w-full" size="lg">
          进入工作台
        </SubmitButton>
      </form>

      {showDemo && (
        <div className="mt-8">
          <p className="label-mono mb-2">演示账号</p>
          <p className="mb-3 text-[11px] text-muted">
            统一密码 <span className="font-mono text-ink">admin123</span>
          </p>
          <div className="space-y-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("admin123");
                }}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-ink/25"
              >
                <span>
                  <span className="block text-[12px] font-medium text-ink">
                    {account.name}
                  </span>
                  <span className="block font-mono text-[10px] text-muted">
                    {account.email}
                  </span>
                </span>
                <span className="text-[11px] text-muted">{account.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
