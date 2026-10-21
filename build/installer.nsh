; Use NSIS's built-in license page as an information page, not a new EULA.
; These values are resolved using the installer's Windows-selected language.
!ifndef BUILD_UNINSTALLER
  LangString sefiPrivacyTitle 1033 "Privacy information"
  LangString sefiPrivacyTitle 1049 "Конфиденциальность"
  LangString sefiPrivacySubtitle 1033 "How SEFI Launcher uses data and network services."
  LangString sefiPrivacySubtitle 1049 "Как SEFI Launcher использует данные и сетевые сервисы."
  LangString sefiPrivacyTop 1033 "Read the privacy information before installing SEFI Launcher."
  LangString sefiPrivacyTop 1049 "Ознакомьтесь с обработкой данных перед установкой SEFI Launcher."
  LangString sefiPrivacyBottom 1033 "Click Install to continue, or Cancel to stop. Launcher settings stay unchanged."
  LangString sefiPrivacyBottom 1049 "Нажмите «Установить» для продолжения или «Отмена» для выхода. Настройки лаунчера не меняются."
  LangString sefiPrivacyInstall 1033 "Install"
  LangString sefiPrivacyInstall 1049 "Установить"
  ; The notice is read from the beginning, including on systems with RichEdit auto-links.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW sefiPrivacyShow
  Function sefiPrivacyShow
    Push $R0
    FindWindow $R0 "#32770" "" $HWNDPARENT
    GetDlgItem $R0 $R0 1000
    SendMessage $R0 0x00B1 0 0 ; EM_SETSEL: put the caret at the start
    SendMessage $R0 0x00B7 0 0 ; EM_SCROLLCARET
    SendMessage $R0 0x0115 6 0 ; WM_VSCROLL / SB_TOP
    Pop $R0
  FunctionEnd
  !define MUI_PAGE_HEADER_TEXT "$(sefiPrivacyTitle)"
  !define MUI_PAGE_HEADER_SUBTEXT "$(sefiPrivacySubtitle)"
  !define MUI_LICENSEPAGE_TEXT_TOP "$(sefiPrivacyTop)"
  !define MUI_LICENSEPAGE_TEXT_BOTTOM "$(sefiPrivacyBottom)"
  !define MUI_LICENSEPAGE_BUTTON "$(sefiPrivacyInstall)"
!endif
