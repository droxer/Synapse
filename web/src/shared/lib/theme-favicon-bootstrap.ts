import { applyThemeFavicon, resolveThemeFromStorage } from "@/shared/lib/theme-favicon";

export const THEME_FAVICON_BOOTSTRAP = `
(function(){
  function apply(theme){
    var isDark=theme==="dark";
    var iconHref=isDark?"/favicon-dark.svg":"/favicon-light.svg";
    var appleHref=isDark?"/apple-touch-icon-dark.png":"/apple-touch-icon.png";
    var iconLink=document.querySelector('link[data-theme-favicon="true"]');
    if(!iconLink){
      iconLink=document.createElement("link");
      iconLink.rel="icon";
      iconLink.type="image/svg+xml";
      iconLink.setAttribute("data-theme-favicon","true");
      document.head.appendChild(iconLink);
    }
    iconLink.href=iconHref;
    var appleLink=document.querySelector('link[data-theme-apple-icon="true"]');
    if(!appleLink){
      appleLink=document.createElement("link");
      appleLink.rel="apple-touch-icon";
      appleLink.setAttribute("data-theme-apple-icon","true");
      document.head.appendChild(appleLink);
    }
    appleLink.href=appleHref;
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(function(link){
      if(link.getAttribute("data-theme-favicon")!=="true"){link.remove();}
    });
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(function(link){
      if(link.getAttribute("data-theme-apple-icon")!=="true"){link.remove();}
    });
  }
  function resolveTheme(){
    try{
      var stored=localStorage.getItem("theme");
      if(stored==="light") return "light";
      if(stored==="dark") return "dark";
      if(stored==="system"){
        return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
      }
    }catch(e){}
    return "dark";
  }
  apply(resolveTheme());
})();
`.trim();

/** Used in tests to verify bootstrap matches the shared resolver. */
export function bootstrapThemeForSmokeTest() {
  applyThemeFavicon(resolveThemeFromStorage());
}
