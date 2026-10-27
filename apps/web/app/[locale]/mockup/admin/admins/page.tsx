"use client";

import {
  ADMIN_PERMISSIONS,
  adminCan,
  adminInviteSchema,
  adminRoleSchema,
  canChangeAdmin,
  toFieldErrors,
  type AdminRole,
  type FormErrorCode,
} from "@khmio/shared";
import { BottomSheet, Button, Card, ConfirmDialog, Input, Select, TONE_STYLES } from "@khmio/ui";
import { Check, ChevronRight, Minus, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CURRENT_ADMIN_ID, type MockAdminUser } from "@/mock/mock-admin-billing";
import { useAdmin } from "../../admin-context";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { useFormErrorText } from "@/components/form-ui";
import { PageHeader, Pill, SectionTitle } from "../admin-ui";
import { ROLE_STYLES } from "../money-ui";
import { useTimeAgo } from "../use-admin-data";

const ROLES = adminRoleSchema.options;
type AdminState = "active" | "invited" | "disabled";

const STATE_STYLES: Record<AdminState, string> = {
  active: TONE_STYLES.success,
  invited: TONE_STYLES.warning,
  disabled: TONE_STYLES.muted,
};

function stateOf(admin: MockAdminUser): AdminState {
  if (admin.disabled) return "disabled";
  return admin.lastActiveMinutesAgo === null ? "invited" : "active";
}

// Admin A9 (design/screens.md): who can use the admin area, and as what.
// Roles and their permissions come from packages/shared admin-roles.ts —
// this screen explains them; the API is what enforces them.
export default function AdminUsersPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const errorText = useFormErrorText();
  const { adminUsers, inviteAdmin, changeAdmin } = useAdmin();
  const timeAgo = useTimeAgo();

  const [openId, setOpenId] = useState<string | null>(null);
  const selected = adminUsers.find((admin) => admin.id === openId);
  const [selectedRole, setSelectedRole] = useState<AdminRole>("support");
  const [confirmDisable, setConfirmDisable] = useState(false);

  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("support");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});

  function open(admin: MockAdminUser) {
    setOpenId(admin.id);
    setSelectedRole(admin.role);
  }

  function openInvite() {
    setName("");
    setTelegramUsername("");
    setInviteRole("support");
    setErrors({});
    setInviting(true);
  }

  function handleInvite() {
    const result = adminInviteSchema.safeParse({ name, telegramUsername, role: inviteRole });
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    // One Telegram account = one admin.
    if (adminUsers.some((admin) => admin.telegramUsername.toLowerCase() === result.data.telegramUsername.toLowerCase())) {
      setErrors({ telegramUsername: "telegram_taken" });
      return;
    }
    inviteAdmin(result.data);
    setInviting(false);
  }

  const lastActive = (admin: MockAdminUser) => (admin.lastActiveMinutesAgo === null ? t("admNeverLoggedIn") : timeAgo(admin.lastActiveMinutesAgo));
  const nameCell = (admin: MockAdminUser) => (
    <span className="flex items-center gap-2">
      <span className="truncate font-medium">{admin.name}</span>
      {admin.id === CURRENT_ADMIN_ID && <Pill className="bg-brand/10 text-brand">{t("admYou")}</Pill>}
    </span>
  );

  const columns: DataGridColumn<MockAdminUser>[] = [
    { key: "name", header: t("admColName"), hideable: false, sortable: true, value: (admin) => admin.name, cell: nameCell },
    {
      key: "telegram",
      header: t("fieldTelegram"),
      value: (admin) => admin.telegramUsername,
      cell: (admin) => <span className="text-muted">@{admin.telegramUsername}</span>,
    },
    {
      key: "role",
      header: t("admColRole"),
      sortable: true,
      value: (admin) => ROLES.indexOf(admin.role),
      exportValue: (admin) => t(`role_${admin.role}`),
      cell: (admin) => <Pill className={ROLE_STYLES[admin.role]}>{t(`role_${admin.role}`)}</Pill>,
    },
    {
      key: "state",
      header: t("colStatus"),
      sortable: true,
      value: (admin) => t(`admState_${stateOf(admin)}`),
      cell: (admin) => <Pill className={STATE_STYLES[stateOf(admin)]}>{t(`admState_${stateOf(admin)}`)}</Pill>,
    },
    {
      key: "lastActive",
      header: t("admColLastActive"),
      align: "right",
      sortable: true,
      value: (admin) => admin.lastActiveMinutesAgo ?? Number.MAX_SAFE_INTEGER,
      exportValue: lastActive,
      cell: (admin) => <span className="text-muted">{lastActive(admin)}</span>,
    },
    {
      key: "actions",
      header: t("manage"),
      align: "right",
      hideable: false,
      cell: () => (
        <span className="inline-flex items-center gap-1 font-medium text-brand">
          {t("manage")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ),
    },
  ];

  const canSetRole = selected ? canChangeAdmin(adminUsers, selected.id, { role: selectedRole }) : false;
  const canDisable = selected ? canChangeAdmin(adminUsers, selected.id, { disabled: true }) : false;

  return (
    <>
      <PageHeader
        title={tNav("admins")}
        description={tNav("adminsDescription")}
        actions={
          <Button variant="primary" onClick={openInvite}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("admInvite")}
          </Button>
        }
      />

      <DataGrid
        rows={adminUsers}
        getRowId={(admin) => admin.id}
        columns={columns}
        searchText={(admin) => `${admin.name} ${admin.telegramUsername}`}
        searchPlaceholder={t("admSearchPlaceholder")}
        chips={ROLES.map((role) => ({ value: role, label: t(`role_${role}`), predicate: (admin: MockAdminUser) => admin.role === role }))}
        onRowClick={open}
        renderCard={(admin) => (
          <div className="flex flex-col gap-2">
            <div className="min-w-0">
              {nameCell(admin)}
              <p className="truncate text-sm text-muted">
                @{admin.telegramUsername} · {lastActive(admin)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill className={ROLE_STYLES[admin.role]}>{t(`role_${admin.role}`)}</Pill>
              <Pill className={STATE_STYLES[stateOf(admin)]}>{t(`admState_${stateOf(admin)}`)}</Pill>
            </div>
          </div>
        )}
        exportFileName="admin-users"
        storageKey="admin-users"
      />

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("admRolesTitle")}</SectionTitle>
        {/* "relative" keeps the screen-reader-only labels inside the scrolling card; without it they widen the page on a phone. */}
        <Card className="relative overflow-x-auto p-0">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-3 font-medium text-muted">
                  {t("admPermission")}
                </th>
                {ROLES.map((role) => (
                  <th key={role} scope="col" className="px-3 py-3 text-center font-medium">
                    {t(`role_${role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ADMIN_PERMISSIONS.map((permission) => (
                <tr key={permission}>
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    {t(`perm_${permission}`)}
                  </th>
                  {ROLES.map((role) => (
                    <td key={role} className="px-3 py-3 text-center">
                      {adminCan(role, permission) ? (
                        <>
                          <Check className="mx-auto h-4 w-4 text-success" aria-hidden="true" />
                          <span className="sr-only">{t("admAllowed")}</span>
                        </>
                      ) : (
                        <>
                          <Minus className="mx-auto h-4 w-4 text-muted" aria-hidden="true" />
                          <span className="sr-only">{t("notIncluded")}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted">{t("admRolesNote")}</p>
      </section>

      <BottomSheet open={selected !== undefined} onClose={() => setOpenId(null)} closeLabel={t("close")} title={selected?.name} placement="side">
        {selected && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Pill className={ROLE_STYLES[selected.role]}>{t(`role_${selected.role}`)}</Pill>
              <Pill className={STATE_STYLES[stateOf(selected)]}>{t(`admState_${stateOf(selected)}`)}</Pill>
              <span className="text-muted">@{selected.telegramUsername}</span>
            </div>

            <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              <Select
                label={t("admColRole")}
                value={selectedRole}
                onChange={(e) => {
                  const next = ROLES.find((role) => role === e.target.value);
                  if (next) setSelectedRole(next);
                }}
                options={ROLES.map((role) => ({ value: role, label: t(`role_${role}`) }))}
              />
              <p className="text-muted">{t(`roleHelp_${selectedRole}`)}</p>
              <Button
                variant="primary"
                disabled={selectedRole === selected.role || !canSetRole}
                onClick={() => changeAdmin(selected.id, { role: selectedRole })}
              >
                {t("admApplyRole")}
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              {selected.disabled ? (
                <>
                  <p className="text-muted">{t("admEnableHelp")}</p>
                  <Button variant="secondary" onClick={() => changeAdmin(selected.id, { disabled: false })}>
                    {t("admEnable")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted">{t("admDisableHelp")}</p>
                  <Button variant="danger" disabled={!canDisable} onClick={() => setConfirmDisable(true)}>
                    {t("admDisable")}
                  </Button>
                </>
              )}
            </div>

            {(!canDisable || (selectedRole !== selected.role && !canSetRole)) && !selected.disabled && (
              <p role="status" className="rounded-DEFAULT bg-warning/10 p-3 text-warning">
                {t("admLastOwner")}
              </p>
            )}
            <p className="text-xs text-muted">{t("admAuditNote")}</p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={inviting} onClose={() => setInviting(false)} closeLabel={t("close")} title={t("admInvite")} placement="side">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-muted">{t("admInviteHelp")}</p>
          <Input
            label={t("admColName")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errorText(errors.name)}
          />
          <Input
            label={t("fieldTelegram")}
            prefix="@"
            autoCapitalize="none"
            autoCorrect="off"
            value={telegramUsername}
            onChange={(e) => {
              setTelegramUsername(e.target.value);
              setErrors((prev) => ({ ...prev, telegramUsername: undefined }));
            }}
            error={errorText(errors.telegramUsername)}
          />
          <div className="flex flex-col gap-2">
            <Select
              label={t("admColRole")}
              value={inviteRole}
              onChange={(e) => {
                const next = ROLES.find((role) => role === e.target.value);
                if (next) setInviteRole(next);
              }}
              options={ROLES.map((role) => ({ value: role, label: t(`role_${role}`) }))}
            />
            <p className="text-muted">{t(`roleHelp_${inviteRole}`)}</p>
          </div>
          <Button variant="primary" onClick={handleInvite}>
            {t("admSendInvite")}
          </Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmDisable && selected !== undefined}
        title={t("admDisableConfirmTitle", { name: selected?.name ?? "" })}
        body={t("admDisableConfirmBody")}
        confirmLabel={t("admDisable")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          if (selected) changeAdmin(selected.id, { disabled: true });
          setConfirmDisable(false);
        }}
        onClose={() => setConfirmDisable(false)}
      />
    </>
  );
}
