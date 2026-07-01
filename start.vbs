Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Resolve parent directory
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

Dim pythonwPath
pythonwPath = ""

' Try reading registry
On Error Resume Next
pythonwPath = WshShell.RegRead("HKCU\Software\Python\PythonCore\3.14\InstallPath\WindowedExecutablePath")
On Error GoTo 0

' Fallback 1: Direct check for the discovered path
If pythonwPath = "" Or Not objFSO.FileExists(pythonwPath) Then
    Dim localAppData
    localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
    Dim checkPath
    checkPath = localAppData & "\Python\pythoncore-3.14-64\pythonw.exe"
    If objFSO.FileExists(checkPath) Then
        pythonwPath = checkPath
    End If
End If

' Fallback 2: Check for WindowsApps pyw.exe
If pythonwPath = "" Or Not objFSO.FileExists(pythonwPath) Then
    Dim checkPathApps
    checkPathApps = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\WindowsApps\pyw.exe"
    If objFSO.FileExists(checkPathApps) Then
        pythonwPath = checkPathApps
    End If
End If

' Fallback 3: Standard pyw.exe
If pythonwPath = "" Then
    pythonwPath = "pyw.exe"
End If

' Run the Flask app silently
WshShell.Run """" & pythonwPath & """ """ & strPath & "\web\app.py""", 0, false
