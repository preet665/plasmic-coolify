/** @format */

import { U, UU } from "@/wab/client/cli-routes";
import { promptNewTeam } from "@/wab/client/components/dashboard/dashboard-actions";
import NavSeparator from "@/wab/client/components/dashboard/NavSeparator";
import NavTeamSection from "@/wab/client/components/dashboard/NavTeamSection";
import NavWorkspaceButton from "@/wab/client/components/dashboard/NavWorkspaceButton";
import { recentlyEndedTrial } from "@/wab/client/components/FreeTrial";
import {
  canUpgradeTeam,
  promptBilling,
} from "@/wab/client/components/modals/PricingModal";
import NewProjectModal from "@/wab/client/components/NewProjectModal";
import { PublicLink } from "@/wab/client/components/PublicLink";
import { Avatar } from "@/wab/client/components/studio/Avatar";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import {
  DefaultDefaultLayoutProps,
  PlasmicDefaultLayout,
  PlasmicDefaultLayout__OverridesType,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicDefaultLayout";
import { useBrowserNotification } from "@/wab/client/utils/useBrowserNotification";
import { ensure } from "@/wab/shared/common";
import { TeamId, WorkspaceId } from "@/wab/shared/ApiSchema";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Dropdown, Menu, MenuProps } from "antd";
import * as _ from "lodash";
import { observer } from "mobx-react";
import * as React from "react";
import { useState } from "react";
import { matchPath, useHistory } from "react-router-dom";

type DefaultLayoutProps = DefaultDefaultLayoutProps & {
  helpButton: PlasmicDefaultLayout__OverridesType["helpButton"];
};

function DefaultLayout_(
  props: DefaultLayoutProps,
  ref: HTMLElementRefOf<"div">
) {
  const appCtx = useAppCtx();
  const userInfo = ensure(
    appCtx.selfInfo,
    "DefaultLayout requires appCtx to contain user information"
  );
  const history = useHistory();

  const [activeTeam, setActiveTeam] = React.useState<TeamId | undefined>(
    undefined
  );
  const [activeWorkspace, setActiveWorkspace] = React.useState<
    WorkspaceId | undefined
  >(undefined);

  const updateLocation = (path: string) => {
    const matchTeam = UU.org.parse(path);
    const matchTeamSettings = UU.orgSettings.parse(path);
    const matchWorkspace = UU.workspace.parse(path);

    setActiveTeam(
      (matchTeam?.params.teamId ||
        matchTeamSettings?.params.teamId ||
        appCtx.workspaces.find(
          (w) => w.id === matchWorkspace?.params.workspaceId
        )?.team.id) as TeamId | undefined
    );
    setActiveWorkspace(
      matchWorkspace?.params.workspaceId as WorkspaceId | undefined
    );
  };

  const teams = appCtx.getAllTeams();
  const workspaces = _.sortBy(appCtx.workspaces, (w) => w.name);
  const teamsToShow = teams.filter((t) => !activeTeam || activeTeam === t.id);
  const teamsOnTrial = teamsToShow.filter((t) => t.onTrial);
  const trialTeamToShow =
    teamsOnTrial.length > 0
      ? teamsOnTrial.reduce((a, b) =>
          a.trialStartDate! < b.trialStartDate! ? a : b
        )
      : teamsToShow.find((t) => recentlyEndedTrial(appCtx, t));

  React.useEffect(() => {
    updateLocation(history.location.pathname);
    const disposeHistory = history.listen((location) => {
      updateLocation(location.pathname);
    });

    return () => {
      disposeHistory();
    };
  }, [appCtx.teams, appCtx.workspaces]);

  const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);

  useBrowserNotification();

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'settings',
      label: <PublicLink href={UU.settings.fill({})}>Settings</PublicLink>,
    },
    {
      key: 'signout',
      label: 'Sign Out',
      onClick: async () => {
        await appCtx.logout();
      },
    },
  ];

  const brand =
    appCtx.appConfig.brands?.[activeTeam ?? ""] ??
    appCtx.appConfig.brands?.[""];

  const [newProjectWorkspaceId, setNewProjectWorkspaceId] =
    useState<WorkspaceId>();

  const requestNewProjectCreation = (workspaceId?: WorkspaceId) => {
    setNewProjectWorkspaceId(workspaceId);
    setShowNewProjectModal(true);
  };

  const projectCreationMenuItems: MenuProps['items'] = React.useMemo(() => {
    if (!props.newProjectButtonAsDropdown) {
      return [];
    }

    const items: MenuProps['items'] = teams.map((team) => ({
      type: 'group',
      label: team.name,
      key: team.id,
      children: workspaces
        .filter((w) => w.team.id === team.id)
        .map((workspace) => ({
          key: workspace.id,
          label: workspace.name,
          onClick: () => requestNewProjectCreation(workspace.id),
        })),
    }));

    if (teams.length === 0) {
      items.push({
        key: 'create-team',
        label: <span>No teams - <strong>create a team</strong></span>,
        onClick: async () => {
          await promptNewTeam(appCtx, history);
        },
      });
    }
    return items;
  }, [teams, workspaces, props.newProjectButtonAsDropdown, requestNewProjectCreation, appCtx, history]);

  return (
    <>
      <PlasmicDefaultLayout
        root={{ ref }}
        {...props}
        headerLogoLink={{
          as: PublicLink,
          props: brand.logoHref
            ? {
                href: brand.logoHref,
              }
            : {},
        }}
        headerLogo={
          brand.logoImgSrc
            ? {
                render: () => <img src={brand.logoImgSrc} />,
              }
            : undefined
        }
        freeTrial={{
          team: trialTeamToShow,
        }}
        teams={teams.map((t, i) => {
          const teamWorkspaces = workspaces.filter((w) => w.team.id === t.id);
          const hasWorkspaces = teamWorkspaces.length > 0;
          return (
            <React.Fragment key={t.id}>
              <NavSeparator />
              <NavTeamSection
                name={t.name}
                {...(hasWorkspaces ? {} : { href: U.org({ teamId: t.id }) })}
                selected={activeTeam === t.id}
                freeTrial={t.onTrial}
              >
                {teamWorkspaces.map((w) => (
                  <NavWorkspaceButton
                    key={w.id}
                    name={w.name}
                    href={U.workspace({ workspaceId: w.id })}
                    selected={activeWorkspace === w.id}
                  />
                ))}
              </NavTeamSection>
            </React.Fragment>
          );
        })}
        newProjectButton={
          props.newProjectButtonAsDropdown
            ? {
                wrap: (newProjectButton) => (
                  <Dropdown trigger={["click"]} menu={{ items: projectCreationMenuItems }}>
                    {newProjectButton}
                  </Dropdown>
                ),
              }
            : {
                onClick: () => requestNewProjectCreation(),
              }
        }
        hideStarters={true}
        upgradeButton={
          teams.some((t) => canUpgradeTeam(appCtx, t))
            ? {
                onClick: async () => {
                  const { tiers } = await appCtx.api.listCurrentFeatureTiers();
                  await promptBilling({
                    appCtx,
                    availableTiers: tiers,
                    title: "",
                    target: {},
                  });
                },
              }
            : {
                render: () => null,
              }
        }
        newTeamButton={{
          onClick: async () => {
            await promptNewTeam(appCtx, history);
          },
        }}
        userButton={{
          props: {
            children: userInfo.firstName,
            "data-test-id": "btn-dashboard-user",
          },
          wrap: (node) => (
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="topLeft"
              trigger={["click"]}
            >
              {node}
            </Dropdown>
          ),
        }}
        avatar={<Avatar size="small" user={userInfo} />}
      />
      {showNewProjectModal && (
        <NewProjectModal
          workspaceId={newProjectWorkspaceId}
          onCancel={() => setShowNewProjectModal(false)}
        />
      )}
    </>
  );
}

const DefaultLayout = observer(React.forwardRef(DefaultLayout_));
export default DefaultLayout;
