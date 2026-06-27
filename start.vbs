Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
' Dynamically resolve parent directory of the script
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
' Run the Flask app inside the web folder silently
WshShell.Run "pyw.exe """ & strPath & "\web\app.py""", 0, false

