!macro customHeader
  ; Custom header for Habakkuk Pharmacy POS installer
!macroend

!macro customInit
  ; Called before installation starts
  DetailPrint "Preparing Habakkuk Pharmacy POS installation..."
!macroend

!macro customInstall
  ; Called during installation
  DetailPrint "Installing Habakkuk Pharmacy POS..."
  
  ; Create user data directory for future syncs
  CreateDirectory "$LOCALAPPDATA\HabakkukPharmacy"
  
  ; Note: The database (prisma/dev.db) is already included in the installer
  ; and will be extracted to the app directory automatically
  DetailPrint "Database pre-loaded with cloud data"
!macroend

!macro customInstallEnd
  ; Called at the end of installation
  DetailPrint "Installation complete!"
  DetailPrint "The app includes pre-populated data from the cloud."
  DetailPrint "It will sync automatically when internet is available."
!macroend

!macro customUnInit
  ; Called before uninstallation
  MessageBox MB_YESNO "Do you want to keep your local pharmacy data?$\r$\n$\r$\nYes = Keep data (can reinstall later and continue)$\r$\nNo = Delete all data" IDYES keep IDNO delete
  
  delete:
    RMDir /r "$LOCALAPPDATA\HabakkukPharmacy"
    DetailPrint "Local data deleted"
    Goto done
    
  keep:
    DetailPrint "Local data preserved"
    
  done:
!macroend
