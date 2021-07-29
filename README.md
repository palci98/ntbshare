# Extension for real-time content sharing
#### ntbshare

This extension allow users to share their notebook document with other users.
The main goal of this extension is for educational purpose. When teacher shares
the notebook document with his students. 

### Prerequisites
- Installed Visual Studio Code Insiders (version: 1.55.0 and more)

### Instalation 

If you want to install this extension you need to open the Visual Studio Code Insiders.
Then go to extensions(Ctrl+Shift+x). Then you need to click on 3 small dots at the top of
the extensions menu. In that menu you need to select **"Install from VSIX..."** then choose the 
VSIX file and wait until the installation will be completed.

### Extension development

If you want to run extension in extension development, you need to run **"npm i"**, to install node_modules directory.
Then you will need to run **"npm run build"** to compile typescript files to javascript. Then you can run this extension in extension development host by pressing **"F5"** button.

### Before running the extension

After installing extension from VSIX, relaunch VS Code Insiders from command line with code-insiders . --enable-proposed-api= pavelpodluzansky.ntbshare" in project folder. If you don't want to run the VS code like this you can hit(Ctrl+Shift+p) and then run the Preferences: Configure Runtime Arguments command to edit the .vscode-insiders/argv.json file to add this extension to a list of enabled extensions like this 
 {
     "enable-proposed-api": ["pavelpodluzansky.ntbshare"]
 }

 ### Running the extension 

 - If you want to share the notebook document you need to have opened some notebook document. 
 - If you want to join the notebook document you need to have opened workspace in the editor.
 - If you want to share a file you need to set a unique room name. 
 - If you want to join a file you need to set some already created room name. 

 The extension is activate after the command ntbshare: Start Sharing a notebook document for sharing purpose or for joiners ntbshare: Join a notebook document. If everything is ok then you will start sharing or you will be joined to a room.

 ### Report problems 
 if you have some problems with this extension don't hesitate to contact me, if something not working or something is unclear for you:
 <xpodlu01@stud.fit.vutbr.cz>