/**
 * Subject: Bachelor's thesis
 * Author: Pavel Podluzansky | xpodlu01@stud.fit.vutbr.cz
 * Year: 2021
 * Description:
 * 
 *      This is the main file for implementation the sharer logic.
 *		The Sharer class controlls events on sharer side and sends 
 *		the changes from events to server. 
 * 
 */

import * as vscode from 'vscode';
import { dmp, destroySharer } from './extension';
import { itemsI } from './extension';

/**
 * 
 * Sharer class manage all communication from sharer to server 
 * 
 */
export class Sharer {
	
	private io = require('socket.io-client');
	private socket = this.io.connect('https://notebookshare.herokuapp.com',{transports: ['websocket','polling']});		
	private fs = require("fs");
	roomName: string;
	private file: itemsI[] = [];	
	private subscription: { dispose(): void }[] = [];
	private uri: vscode.Uri

	constructor(room:string,uri:vscode.Uri){
		this.uri= uri;
		this.roomName = room;
		this.createRoom(this.roomName)

		// binding the events to methods in class
		this.subscription.push(
			vscode.notebooks.onDidChangeNotebookCells(this.cellChange.bind(this)),
			vscode.workspace.onDidChangeTextDocument(this.textChange.bind(this)),
			vscode.notebooks.onDidChangeCellOutputs(this.outputChange.bind(this)),
			vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection.bind(this)),
			vscode.window.onDidChangeNotebookEditorVisibleRanges(this.ondidChangeVisibleRange.bind(this)),
			vscode.workspace.onDidCloseNotebookDocument(this.ondidCloseDocument.bind(this))
			)
			
			this.socket.on('get-room-list-create',(join:boolean)=>{
				if(join)
				{
					let cellFile= vscode.workspace.notebookDocuments[0].getCells();
					cellFile.forEach((value,index) =>{
						this.file.push({
							kind: value.kind,
							index: index,
							text: value.document.getText(),
							output: value.outputs[0] === undefined ? [] : value.outputs[0].items
						});			
					});
					this.socket.emit('create',this.roomName)
					this.share();
					vscode.window.showInformationMessage('Joined session')
				}
				else
				{
					destroySharer();
					vscode.window.showErrorMessage('This room already exist you cannot create it')
				}
			})
	}

	// methods 

	/**
	 * 
	 * Add output adds the output to sharer shadow file and
	 * sends this output to the server.
	 * @param output output of the cell
	 * @param index index of the cell 
	 */
	addOutput(output:vscode.NotebookCellOutput[],index:number){
		this.file.splice(index,1,{kind:this.file[index].kind, index:this.file[index].index,text:this.file[index].text,output: output.length===0 ? [] : output[0].items})
		this.socket.emit('Add-output',output,index,this.roomName);
	}
	/**
	 * 
	 * move replace the order of the file and sends the informations
	 * about move change to the server
	 * @param change consists of informations about the cells
	 */
	move(change:{'number':number,deletedCount:number,items:itemsI[]}[]){
		this.file.splice(change[0].number,change[0].deletedCount);
		this.file.splice(change[1].items[0].index,0,{kind:change[1].items[0].kind, index:change[1].items[0].index, text:change[0].items[0].text, output:[change[0].items[0].output[0]]})
		this.socket.emit('move-cell',change,this.roomName);
	}
	/**
	 * Similar to move where the order needs to be reconfigurated
	 * and changes send to the server 
	 * @param change consists of informations about the cell
	 */
	add(change:{'number':number,deletedCount:number,items:itemsI[]}[]){
		if(change[0].deletedCount === 0)
		{
			for(let i=0;i< this.file.length;i++)
			{
				if(this.file[i].index >= change[0].number)
				{
					this.file[i].index = this.file[i].index + 1;
				}
			}   
			for(let i=0;i<change[0].items.length;i++)
			{
				this.file.splice(change[0].items[i].index,0,{kind:change[0].items[i].kind, index:this.file.length,text:change[0].items[i].text,output:change[0].items[0].output})
			}
		}   
		else if(change[0].deletedCount >= 1)
		{
			for(let i = 0; i < this.file.length; i++)
			{
				if(this.file[i].index > this.file[change[0].number].index)
				{
					this.file[i].index = this.file[i].index-1
				}
			}
			this.file.splice(change[0].number,change[0].deletedCount);
		}
		this.socket.emit('Add-cell',change,this.roomName);
	}
	/**
	 * this method send a full file to server
	 */
	share(){		
		this.socket.emit('send_full_file',this.file,this.roomName);
	}
	/**
	 * 
	 * create room sends the roomname to server,
	 * if the room does not exists on the server,
	 * then the room will be created, else the user
	 * need to choose new room name. 
	 * @param roomName the name of the room
	 */
	createRoom(roomName:string){
		this.socket.emit('create-room',roomName)
	}

	// Events
	
	/**
	 * 
	 * If sharer close the NotebookDocument,
	 * then he stopped sharing a file 
	 * @param e Notebook document
	 */
	private ondidCloseDocument(e: vscode.NotebookDocument)
	{
		if(e.uri === this.uri){
			this.socket.emit('delete-room',this.roomName)
			this.socket.close()
			this.subscription.forEach(s => s.dispose());
			destroySharer()
			vscode.window.showInformationMessage("You succesfully stopped document sharing")
		}
	}
	/**
	 * 
	 * The event listening on visible notebook changes
	 * If user scrolls and the window displays new cells,
	 * event will caught this change.
	 * @param e change informations
	 */
	private ondidChangeVisibleRange(e: vscode.NotebookEditorVisibleRangesChangeEvent) {
		this.socket.emit('range',e.visibleRanges,this.roomName)
	}
	/**
	 * 
	 * The event listening on text editor selection change
	 * the selection is then send to the server, as the 
	 * coordinates.
	 * @param event selection change information
	 */
	private onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
		let index: number=0;
		let uri =event.textEditor.document.uri
		let ntbEditor = vscode.window.activeNotebookEditor?.document.getCells()
		ntbEditor!.forEach(element => {
			if(uri === element.document.uri)
			{
				index = element.index
			}
		});
		const selections = event.selections.map(({ start, end }) => {
			return [start.line, start.character, end.line, end.character];
		});
		this.socket.emit('selectionText',selections,index,this.roomName)
	}
	/**
	 * this event listens on notebook cell output changes
	 * @param e notebook cell output change information
	 */
	private outputChange(e: vscode.NotebookCellOutputsChangeEvent)
	{
		let output: vscode.NotebookCellOutput[]=[]
		if(e.cells[0].outputs.length === 0)
		{
			output=[]
		}
		else{
			e.cells[0].outputs.forEach(value=>{
				output.push(value)
			})
		}
		this.addOutput(output,e.cells[0].index)
	}
	/**
	 * This event listen to change in cells.
	 * The changes can be added, deleted, moved cell/s
	 * @param e information about cell change
	 */
	private cellChange(e: vscode.NotebookCellsChangeEvent){
		let items: itemsI[]=[]
		let change: {'number':number,deletedCount:number,items:itemsI[]}[] = []
		if(e.changes.length===1)
		{
			if(e.changes[0].deletedItems.length===0)
			{
				e.changes[0].items.forEach((element,i) => {
					items.push({text:element.document.getText(),index:element.index,kind:element.kind,output: element.outputs.length ===0 || element.outputs === undefined? [] :element.outputs![i].items})
				});
				change.push({'number':e.changes[0].start,'deletedCount':e.changes[0].deletedCount,'items':items})
			}
			else
			{
				e.changes[0].deletedItems.forEach((element,i) => {
					items.push({text:element.document.getText(),index:element.index,kind:element.kind,output: element.outputs.length ===0 || element.outputs === undefined ? [] :element.outputs![i].items})
				});
				change.push({'number':e.changes[0].start,'deletedCount':e.changes[0].deletedCount,'items':items})
			}
			this.add(change);
		}
		else if(e.changes.length===2)
		{
			e.changes[0].deletedItems.forEach((element,i) => {
				items.push({text:element.document.getText(),index:element.index,kind:element.kind,output: element.outputs.length ===0 || element.outputs === undefined ? [] :element.outputs![i].items})
			});
			change.push({'number':e.changes[0].start,'deletedCount':e.changes[0].deletedCount,'items':items,})
			e.changes[1].items.forEach((element,i) => {
				items.push({text:element.document.getText(),index:element.index,kind:element.kind,output: element.outputs.length ===0 || element.outputs === undefined ? [] :element.outputs![i].items})
			});
			change.push({'number':e.changes[1].start,'deletedCount':e.changes[1].deletedCount,'items':items})
			this.move(change);
		}
	}
	/**
	* This event listen to text change in cells.
	* The patch is created here and after creation,
	* the patch is send to the server
	* @param e information about text change
	*/
	private textChange(e: vscode.TextDocumentChangeEvent)
	{
		setTimeout(() => {
			let actualfile= vscode.window.activeNotebookEditor!.document.getCells();
			actualfile.forEach(value=>{
				if(value.document.uri === e.document.uri)
				{
					let patches={index: value.index,cellText: dmp.patch_make(this.file[value.index].text,e.document.getText())}
					this.file[value.index].text = e.document.getText()
					this.socket.emit('patch',patches,this.roomName);
				}
			})
		}, 350);
	}
} 
