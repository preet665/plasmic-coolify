import { main } from "@/wab/client/components/Shell";
import { dbg } from "@/wab/shared/dbg";
import "@/wab/styles/antd-overrides.less";
import "@/wab/styles/loader.scss";
import "@/wab/styles/main.sass";
import "jquery";
import "jquery-serializejson";
import mobx from "@/wab/shared/import-mobx";

// Configure mobx with the appropriate settings for React 18
mobx.configure({
  enforceActions: "never",
  // Recommended for React 18 to avoid unnecessary re-renders
  reactionScheduler: (f) => setTimeout(f, 0),
});

dbg.mobx = mobx;

//
// Main application code
//
main();
