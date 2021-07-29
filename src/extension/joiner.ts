/**
 * Subject: Bachelor's thesis
 * Author: Pavel Podluzansky | xpodlu01@stud.fit.vutbr.cz
 * Year: 2021
 * Description:
 * 
 *      This is the main file for implementation the joiner logic.
 *		The joiner class listening to events sending from server.
 *      If some changes comes from server then the changes must be 
 *      applied in a user editor. 
 * 
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { patch_obj } from 'diff-match-patch';
import { dmp, destroyClient, itemsI,joiner } from "./extension";
import { RawCellOutput } from './ntbShareProvider';
import * as jsdiff from 'diff';

/**
 *  Class Joiner is responsible for getting the data from server
 *  and vizualize this data with help from NotebookSerializer.
 *  
 */
export class Joiner{

    private io = require('socket.io-client');
    private subscription: { dispose(): void }[] = [];
    private fs = require("fs");
    private fileName:string;
	private socket = this.io.connect('https://notebookshare.herokuapp.com',{transports: ['websocket','polling']});		
    
    constructor(roomName:string){
        this.fileName = ""
        this.subscription.push(vscode.workspace.onDidCloseNotebookDocument(this.ondidCloseDocument.bind(this)))
        this.socket.emit('join-room',roomName);
        this.socket.on('end',()=>{
            vscode.window.showInformationMessage('The file sharer stopped sharing a file')
            this.socket.close()
            destroyClient()
        })
        
        /**
         *  socket.on('get-room-list-join',function(join:boolean):
         *      If the room exist on server then join will be true,
         *      then client can join the room, else the room not exists,
         *      so the error message will be rendered
         */
        this.socket.on('get-room-list-join',(join:boolean) =>{
            if(join === true)
            {
                this.socket.emit('join',roomName)
            }
            else
            {
                destroyClient()
                vscode.window.showErrorMessage('This room does not exist, please join another room or create a new one')
            }
        })

        this.socket.on('rangeChange',function(range: vscode.NotebookRange[],roomName:string){
            vscode.window.activeNotebookEditor?.revealRange(new vscode.NotebookRange(range[0].start,range[0].end),vscode.NotebookEditorRevealType.InCenter)
        })
        /**
         * rendering sharer selection in connected client editor.
         * 
         */
        this.socket.on('selection',async function(selections:number[][],index:number,roomName:string){
            await vscode.window.showNotebookDocument(vscode.window.activeNotebookEditor!.document,{selections:[new vscode.NotebookRange(index,index+1)]})
            const activeEditor = vscode.window.activeNotebookEditor?.document.getCells()
            const visibleEditors = vscode.window.visibleTextEditors
            let editor: vscode.TextEditor | undefined
            activeEditor!.forEach(element => {
                if(element.index=== index)
                {
                    visibleEditors.forEach(e => {
                        if(element.document.uri === e.document.uri)
                            editor = e
                        else
                            return 
                    });
                }
            });

            if(editor !== undefined){

                let select: vscode.Selection[] =[]
                selections.map((selection)=>
                {
                    const [sLine, sChar, eLine, eChar] = selection;
                    select.push(new vscode.Selection(new vscode.Position(sLine,sChar),new vscode.Position(eLine,eChar)))
                })
                editor!.selections = select
            }
        })
        /**
         * 
         *  Function is called When user join the share notebook document.
         *  The content of the file is then save as the format which can be
         *  open by ntbShareProvider.
         */
        this.socket.on('get-file',async (file: itemsI[]) =>{
            var JSONFILE: { cells: { cell_type: string,source: [string]; outputs:RawCellOutput[]}[]; }[] = [];
            var JSONMY: {cell_type: string,"source":[string], outputs:RawCellOutput[]}[]= [];
            file.forEach((element,index) => {
                if(file[index].kind===2)
                    JSONMY.push({
                        "cell_type": "code",
                        "source": [file[index].text],
                        "outputs": file[index].output.length=== 0 ? [] : file[index].output
                    });
                else
                    JSONMY.push({
                        "cell_type": "markdown",
                        "source": [file[index].text],
                        "outputs": []
                    });
                })
            JSONFILE.push({
                "cells" : JSONMY
            })
            let string = JSON.stringify(JSONFILE);
            this.fileName = roomName + 'file.ipynb'
            await this.fs.writeFile(path.join(vscode.workspace?.workspaceFolders![0].uri.fsPath, this.fileName), string.substring(1,string.length-1), (err:any) => {
                if (err) throw err;
            });
            const fileToOpen = vscode.Uri.file(path.join(vscode.workspace?.workspaceFolders![0].uri.fsPath, this.fileName));
            await vscode.commands.executeCommand('vscode.openWith',fileToOpen,'notebook')
            vscode.window.showInformationMessage('Joined session')
        })

        /**
         *      If sharer made some text changes in notebook cell then server send these changes to the client. 
         *      Client listen for these changes and render the incoming changes. The patch is here to patch the old text to new one.    
         */
        this.socket.on('patch-client', async function(patches: {index:number,cellText:patch_obj[]}){
            const edit = new vscode.WorkspaceEdit();
            let actualFile= vscode.window.activeNotebookEditor!.document.getCells(new vscode.NotebookRange(patches.index,patches.index+1));
            let document = actualFile[0].document
            let documentText = document.getText()
            
            // apply patch
            let [text,result] = dmp.patch_apply(patches.cellText,documentText);
            let start = new vscode.Position(0,0)
            let endLine = document.lineAt(document.lineCount-1);
            let end = new vscode.Position(document.lineCount - 1, endLine.text.length);
            const jsDP = jsdiff.diffChars(documentText,text);
            let index = 0;
            /**
             * 
             *  The patch application in editor.
             */
            for(const patch of jsDP){
                if(patch.count === undefined)
                continue
                if(patch.added)
                {   
                    if(patch.count>1){
                        edit.replace(document.uri,new vscode.Range(start,end),text)
                        await vscode.workspace.applyEdit(edit)
                        return
                    }
                    else
                    {
                        edit.insert(actualFile[0].document.uri,document.positionAt(index),patch.value)
                        await vscode.workspace.applyEdit(edit)
                    }
                
                }
                else if(patch.removed)
                {
                    edit.delete(actualFile[0].document.uri,new vscode.Range(document.positionAt(index),document.positionAt(index+patch.count)))
                    await vscode.workspace.applyEdit(edit);
                }
                else
                {
                    index += patch.count;
                }
            } 
        });

        /**
        *  
        *    If sharer execute some cell or cells then server send these changes
        *    to the client. Client listen for these changes and render the incoming outputs.   
        */
        this.socket.on('Output-add', async function(output:vscode.NotebookCellOutput[],index:number){
            let text =vscode.window.activeNotebookEditor!.document.getCells(new vscode.NotebookRange(index,index+1))
            await vscode.window.activeNotebookEditor!.edit(editBuilder =>{  
                editBuilder.replaceCells(index,index+1,[{
                    "kind": vscode.NotebookCellKind.Code,
                    "value": text[0].document.getText(),
                    "languageId": "python",
                    "outputs": output
                }])
            })
            vscode.window.showNotebookDocument(vscode.window.activeNotebookEditor!.document,{selections:[new vscode.NotebookRange(index,index+1)]})
        })   

        /**
         *
         *   If sharer move some cell or cells server sends these changes. Client listen for these changes and render it
         */
        this.socket.on('Move-cell',async function(change:{'number':number,deletedCount:number,items:itemsI[]}[]){
            await deleteCell(change[0].number,change[0].deletedCount)
            await addCell(change[1].items[0].text,change[1].items[0].index,change[1].items[0].kind,change[1].items[0].output);
        })

        /**
         *  
         *   If sharer add or delete some cell or cells. 
         *   Client listen for the changes sent by server and render it.
         */
        this.socket.on('Update-cell',async function(change:{'number':number,deletedCount:number,items:itemsI[]}[]){
            if(change[0].deletedCount === 0){
                for(const element of change[0].items)
                {
                    await addCell(element.text,element.index,element.kind,element.output)
                }
            }
            else if(change[0].deletedCount >= 1)
            {
                await deleteCell(change[0].number,change[0].deletedCount)
            }
        })
    }        

    /**
     * 
     * If connected user close the notebook document then he will be disconnected
     * @param document closed notebook document 
     */
    private ondidCloseDocument(document: vscode.NotebookDocument){
        if(document.uri.path === vscode.Uri.file(path.join(vscode.workspace?.workspaceFolders![0].uri.fsPath, joiner!.fileName)).path)
        {
            this.socket.close()
            destroyClient()
            vscode.window.showInformationMessage("You have been disconnected")
        }
    }
}

/**
 * The function delete the cell from opened notebook document.
 * 
 * @param index index of the cell 
 * @param count the count of how many cells to delete
 */
async function deleteCell(index:number, count:number){
    await vscode.window.activeNotebookEditor!.edit(editBuilder =>
        editBuilder.replaceCells(index,index+count,[])
    )
    vscode.window.showNotebookDocument(vscode.window.activeNotebookEditor!.document,{selections:[new vscode.NotebookRange(index,index+1)]})
}

/**
 * The function adds cell to a opened notebook
 * @param text the text in the cell
 * @param index index of the cell
 * @param kind kind of the cell
 * @param output output of the cell
 */
async function addCell(text:string,index:number,kind:vscode.NotebookCellKind,output:RawCellOutput[]|undefined){
    await vscode.window.activeNotebookEditor!.edit(editBuilder =>{  
        editBuilder.replaceCells(index,index,[{
            "kind": kind,
            "value": text,
            "languageId": "python",
            "outputs": output === undefined || output.length === 0 ? [] : [new vscode.NotebookCellOutput(output.map(item => new vscode.NotebookCellOutputItem(item.data,item.mime)))]
        }])
    }); 
    vscode.window.showNotebookDocument(vscode.window.activeNotebookEditor!.document,{selections:[new vscode.NotebookRange(index,index+1)]})
}