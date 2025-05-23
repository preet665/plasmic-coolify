// This is a skeleton starter React component generated by Plasmic.
// This file is owned by you, feel free to edit as you see fit.
import { COMMANDS } from "@/wab/client/commands/command";
import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { PropEditorRow } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import StyleSelect from "@/wab/client/components/style-controls/StyleSelect";
import {
  DefaultNewVariableProps,
  PlasmicNewVariable,
} from "@/wab/client/plasmic/plasmic_kit_state_management/PlasmicNewVariable";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { wabTypeToPropType } from "@/wab/shared/code-components/code-components";
import { assert, ensure, spawn } from "@/wab/shared/common";
import { isPageComponent } from "@/wab/shared/core/components";
import {
  getAccessTypeDisplayName,
  STATE_VARIABLE_TYPES,
  StateAccessType,
  StateVariableType,
} from "@/wab/shared/core/states";
import { exprUsesDollarVars } from "@/wab/shared/eval/expression-parser";
import { Component, isKnownTplSlot, State } from "@/wab/shared/model/classes";
import { convertVariableTypeToWabType } from "@/wab/shared/model/model-util";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { notification } from "antd";
import L from "lodash";
import { observer } from "mobx-react";
import * as React from "react";

export interface NewVariableProps extends DefaultNewVariableProps {
  state: State;
  component: Component;
  studioCtx: StudioCtx;
  mode?: "new" | "edit";
  onCancel?: () => void;
  onConfirm?: () => void;
}

const VariableEditingForm = observer(
  React.forwardRef(function VariableEditingForm(
    {
      component,
      state,
      studioCtx,
      mode = "edit",
      onCancel,
      onConfirm,
      ...rest
    }: NewVariableProps,
    ref: HTMLElementRefOf<"div">
  ) {
    const vc = ensure(studioCtx.focusedOrFirstViewCtx(), "");
    assert(
      !isKnownTplSlot(component.tplTree),
      "slots can't be root of a component"
    );
    const StringEditor = React.useCallback(
      ({
        label,
        onChange,
        value,
        "data-plasmic-prop": dataPlasmicProp,
      }: {
        label: React.ReactNode;
        onChange: (val: string) => void;
        value: string;
        "data-plasmic-prop"?: string;
      }) => (
        <LabeledItemRow layout={"vertical"} label={label}>
          <StringPropEditor
            onChange={onChange}
            value={value}
            valueSetState={"isSet"}
            disabled={false}
            data-plasmic-prop={dataPlasmicProp}
          />
        </LabeledItemRow>
      ),
      []
    );

    const hasExternalAccess = state.accessType !== "private";
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm?.();
        }}
      >
        <PlasmicNewVariable
          root={{ ref }}
          {...rest}
          variableName={
            <StringEditor
              label={state.implicitState ? "External name" : "Name"}
              onChange={(val) =>
                COMMANDS.component.changeStateVariableName.execute(
                  studioCtx,
                  {
                    varName: val,
                  },
                  {
                    state,
                    component,
                  }
                )
              }
              data-plasmic-prop={"variable-name"}
              value={state.param.variable.name}
            />
          }
          variableType={{
            props: {
              value: state.variableType,
              "data-plasmic-prop": "variable-type",
              onChange: (val) =>
                COMMANDS.component.changeStateVariableType.execute(
                  studioCtx,
                  {
                    type: val as StateVariableType | null,
                  },
                  {
                    state,
                  }
                ),
              children: STATE_VARIABLE_TYPES.filter(
                (stateType) => stateType !== "variant"
              ).map((stateType) => (
                <StyleSelect.Option value={stateType} key={stateType}>
                  {L.startCase(stateType)}
                </StyleSelect.Option>
              )),
            },
          }}
          isPageComponent={isPageComponent(component)}
          variableInitVal={
            <div
              style={{ position: "relative", width: "100%" }}
              className={"flex-fill"}
            >
              <PropEditorRow
                viewCtx={vc}
                tpl={component.tplTree}
                label={"Initial Value"}
                attr="initial-value"
                expr={state.param.defaultExpr ?? undefined}
                definedIndicator={{ source: "none" }}
                valueSetState={"isSet"}
                propType={wabTypeToPropType(
                  convertVariableTypeToWabType(
                    state.variableType as StateVariableType
                  )
                )}
                onChange={async (expr) => {
                  if (
                    state.accessType === "writable" &&
                    expr &&
                    exprUsesDollarVars(expr)
                  ) {
                    notification.error({
                      message: "Cannot set initial value",
                      description:
                        "Initial value for read-and-write state can not contain references to dynamic values that are available only in the current component context.",
                    });
                    return;
                  }
                  await COMMANDS.component.changeStateInitialValue.execute(
                    studioCtx,
                    {
                      expr,
                    },
                    {
                      state,
                    }
                  );
                }}
                layout={"vertical"}
                disableLinkToProp={true}
              />
            </div>
          }
          allowExternalAccess={{
            props: {
              isChecked: hasExternalAccess,
              onChange: (allow) => {
                spawn(
                  COMMANDS.component.changeStateVariableAccessType.execute(
                    studioCtx,
                    {
                      accessType: allow ? "readonly" : "private",
                    },
                    {
                      state,
                    }
                  )
                );
              },
              "data-test-id": "allow-external-access",
            },
          }}
          isExternal={hasExternalAccess}
          accessTypeSelect={{
            props: {
              "data-plasmic-prop": "access-type",
              value: state.accessType,
              onChange: async (val) => {
                if (
                  val === "writable" &&
                  state.param.defaultExpr &&
                  exprUsesDollarVars(state.param.defaultExpr)
                ) {
                  notification.error({
                    message: "Cannot set access type",
                    description:
                      "Variable initial value contains references to dynamic values. Remove those references to be able to set access type to read-write.",
                  });
                  return;
                }
                await COMMANDS.component.changeStateVariableAccessType.execute(
                  studioCtx,
                  {
                    accessType: val as StateAccessType,
                  },
                  {
                    state,
                  }
                );
              },
              children: (
                [
                  {
                    value: "readonly",
                    label: getAccessTypeDisplayName("readonly"),
                  },
                  {
                    value: "writable",
                    label: getAccessTypeDisplayName("writable"),
                  },
                ] as { value: StateAccessType; label: string }[]
              ).map(({ label, value }) => (
                <StyleSelect.Option value={value} key={value}>
                  {label}
                </StyleSelect.Option>
              )),
            },
          }}
          accessType={
            state.accessType === "private"
              ? "_private"
              : (state.accessType as Exclude<StateAccessType, "private">)
          }
          isImplicitState={!!state.tplNode}
          withFormButtons={mode === "new"}
          cancelButton={{
            onClick: () => onCancel?.(),
          }}
          confirmButton={{
            props: {
              htmlType: "submit",
              "data-test-id": "confirm",
            },
          }}
        />
      </form>
    );
  })
);
export default VariableEditingForm;
