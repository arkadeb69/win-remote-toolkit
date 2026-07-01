Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Dynamically resolve parent directory of the script
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

Function FindPythonW()
    Dim val, v
    Dim versions
    versions = Array("3.15", "3.14", "3.13", "3.12", "3.11", "3.10", "3.9")
    
    On Error Resume Next
    For Each v In versions
        val = WshShell.RegRead("HKCU\Software\Python\PythonCore\" & v & "\InstallPath\WindowedExecutablePath")
        If Err.Number = 0 And val <> "" Then
            If objFSO.FileExists(val) Then
                FindPythonW = val
                Exit Function
            End If
        End If
        Err.Clear
        val = WshShell.RegRead("HKLM\Software\Python\PythonCore\" & v & "\InstallPath\WindowedExecutablePath")
        If Err.Number = 0 And val <> "" Then
            If objFSO.FileExists(val) Then
                FindPythonW = val
                Exit Function
            End If
        End If
        Err.Clear
    Next
    
    Dim envPath, paths, p, fullPath
    envPath = WshShell.ExpandEnvironmentStrings("%PATH%")
    paths = Split(envPath, ";")
    For Each p In paths
        If p <> "" Then
            If Right(p, 1) <> "\" Then p = p & "\"
            If InStr(LCase(p), "microsoft\windowsapps") = 0 Then
                fullPath = p & "pythonw.exe"
                If objFSO.FileExists(fullPath) Then
                    FindPythonW = fullPath
                    Exit Function
                End If
            End If
        End If
    Next

    FindPythonW = "pythonw.exe"
End Function

pythonwPath = FindPythonW()

' Run the Flask app inside the web folder silently
WshShell.Run """" & pythonwPath & """ """ & strPath & "\web\app.py""", 0, False
