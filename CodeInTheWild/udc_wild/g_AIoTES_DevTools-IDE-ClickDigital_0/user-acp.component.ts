import { Component, OnInit, ViewEncapsulation, ViewContainerRef, ComponentFactoryResolver, ViewChild} from '@angular/core';
import { Message, MenuItem, ConfirmationService, SelectItem } from 'primeng/api';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import { TabMenuModule } from 'primeng/tabmenu';
import { ActivatedRoute, Router, NavigationStart} from '@angular/router';
import { SelectButtonModule } from 'primeng/selectbutton';
import {ListboxModule} from 'primeng/listbox';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';

import {DatabaseService} from '../../services/database.service';
import uuidv4 from 'uuid/v4';
import {ProjectDB} from '../../models/database/project';
import {DashboardDB} from '../../models/database/dashboard';
import {SheetDB} from '../../models/database/sheet';
import {User} from '../../models/frontend/user';
import {CONFLICT} from 'http-status-codes';
import {Widget} from '../../models/frontend/widget';
import {WidgetDB} from '../../models/database/widget';


import {DataPrivacyElementBackend} from '../../models/backend/dataprivacyelementbackend';
import {ACPService} from '../../services/acp.service';

@Component({
  selector: 'app-user-acp',
  templateUrl: './user-acp.component.html',
  styleUrls: ['./user-acp.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [ConfirmationService, ACPService]
})

export class UserACPComponent implements OnInit { 
  @ViewChild('overview') overview;
  @ViewChild('change') change;
  @ViewChild('add') add;
  protected userMsgs: Array<Message> = [];
  private children: string[];
  private arguments;
  private users;
  
  protected role: Array<SelectItem>;
  protected ROLEDEVELOPER = 'developer';
  private ROLEENDUSER = 'enduser';
  
  protected changeUserForm: FormGroup;
  protected addUserForm: FormGroup;
  
  emailPattern = '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$';
  constructor(private confirmationService: ConfirmationService, private route: ActivatedRoute, private databaseService: DatabaseService, private fb: FormBuilder, private acpS: ACPService) {
  }

  ngOnInit(): void {
	this.children = ['overview', 'change', 'add'];
	this.users = [];
	
	this.initChangeArea();
	this.initAddArea();
	
	//event listener for updating the displayed content (for the "user" area)
	this.route.fragment.subscribe(
	  (fragments) => {
        let url = this.getPreparedURL();
        if (url[0] === 'user') {
		  var key = url[1];
		  for (var currentKey of this.children) this[currentKey].nativeElement.style.display = "none";
		  if (this[key] != null) { 
		    var callName = 'update' + key.charAt(0).toUpperCase() + key.slice(1) + 'Area';
			if (this[callName] != null) {
		      this[callName](...this.arguments);
			  this.arguments = [];
		    }
			this[key].nativeElement.style.display = "";
		  } else {
			this.userMsgs.push({
			  severity: 'error',
			  summary: 'Error',
			  detail: 'component of <b>' + key + '</b> is undefined'
		    });
		  }			  
		}
      }
	);
  }
  
  /* ---------------------------- SAMPLES ----------------------------*/
  /**
   * adjusts the URL accordingly to enable the trigger for updating content
   *
   * @param key which page should be displayed?
   */
  private show(key:string = '', ...args) {
    key = key === '' ? this.children[0] : key;
	this.arguments = args;
	if (key !== this.getPreparedURL()[1]) window.location.assign('/acp#user/' + key);
  }
  
  /**
   * trivial
   */
  protected goBack() {
    window.history.back();
  }
  
  /**
   * URL content is adapted so that further processing of the fragments can function without problems
   *
   * @return string url without parameters
   */
  protected getPreparedURL():string[] {
	let url = this.route.snapshot.fragment;
	if (url == null) url = '';
    url = url.split('?')[0]; //Parameterangaben abschneiden
	
	return url.split('/');
  }
  
  protected getUser(userID:string) {
    for (var user of this.users) {
      if (user.userId === userID) return user;
	}
	return null;
  }
  
  /* ---------------------------- OVERVIEW AREA ----------------------------*/
  private updateOverviewArea() {
    this.acpS.getAllUsers().subscribe(result => {
       this.users = result;
	   
	});
  }
  
  /**
   * input values are initialized according to the expected contents
   * PAGE[OVERVIEW]:BUTTON@`CHANGE` (prepareChangeArea(userID))-> PAGE[CHANGE]:INPUTS@USERS[userID]
   * 
   * @param userID
   */
  private prepareChangeArea(userID: string) {
	this.show('change');
	
	let user = this.getUser(userID);
	this.changeUserForm.patchValue({
	  id: user.userId,
      username: user.username,
      role: user.role,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
	  confirmed: user.confirmed
    });  
  }
  
  /**
   * input values are initialized according to the expected contents
   * PAGE[OVERVIEW]:BUTTON@`RESET PASSWORD` (prepareResetPasswordArea(userID))-> (PAGE[OVERVIEW]:CONFIRM@`Are you sure ...` (accept)-> PAGE[OVERVIEW])
   * 
   * @param userID
   */
  private prepareResetPasswordArea(userID: string) {
	this.confirmationService.confirm({
	  message: 'Are you sure that you want to perform this action?',
      accept: () => {
		this.acpS.resetUserPassword(userID).subscribe(result => {
		  this.userMsgs.push({
            severity: 'success',
            summary: 'successful',
            detail: '...'
          });
		  this.show('overview');
		}, err => {
		  this.userMsgs.push({
            severity: 'error',
            summary: 'Error!'
          });
		});
      }
    }); 
  }
  
  /**
   * input values are initialized according to the expected contents
   * PAGE[OVERVIEW]:BUTTON@`REMOVE` (prepareRemoveArea(userID))-> (PAGE[OVERVIEW]:CONFIRM@`Are you sure ...` (accept)-> PAGE[OVERVIEW]:USERS\USERS[userID])
   * 
   * @param userID
   */
  private prepareRemoveArea(userID: string) {
	this.confirmationService.confirm({
	  message: 'Are you sure that you want to perform this action?',
      accept: () => {
		this.acpS.removeUser(userID).subscribe(result => {
		  this.userMsgs.push({
            severity: 'success',
            summary: 'successful',
            detail: 'User was removed!'
          });
		  document.getElementById(userID).remove();
		  this.show('overview');
		}, err => {
		  this.userMsgs.push({
            severity: 'error',
            summary: 'Error!'
          });
		});
      }
    });  
  }
  
  
  /* ---------------------------- CHANGE AREA ----------------------------*/
  private initChangeArea() {
	let formControls = {};
    formControls['id'] = new FormControl({value: '', disabled: true}, Validators.nullValidator);
	formControls['username'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(6)]));
	formControls['role'] = new FormControl('', Validators.required);
	formControls['email'] = new FormControl('', Validators.compose([Validators.required, Validators.pattern(this.emailPattern)]));
	formControls['firstname'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(32)]));
	formControls['lastname'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(64)]));
	formControls['confirmed'] = new FormControl({value: '', disabled: true}, Validators.nullValidator);
    this.changeUserForm = this.fb.group(formControls);
	
	this.role = [];
	this.role.push({label: 'Enduser', value: 'enduser'});
    this.role.push({label: 'Developer', value: 'developer'});
  }
  
  private updateChangeArea() {
    
  }
  
  /**
   * this method checks the inputs and change user properties if the inputs are correct
   * 
   * @param data the user inputs
   */
  private checkUserChanges(data) {
	let userID = this.changeUserForm.controls.id.value;
	
	let user = {
	  role: data.role.toString(),
	  userId: userID,
	  email: data.email,
	  username: data.username,
	  firstname: data.firstname,
	  lastname: data.lastname,
	  password: data.password,
	  checkedSettings: [],
	  confirmed: data.confirmed
	};

	this.acpS.updateUser(userID, user).subscribe(result => {
      this.userMsgs.push({
        severity: 'success',
        summary: 'user has been changed',
        detail: user.username
      });
	  this.initChangeArea();
      this.goBack();
	}, err => {
	  this.userMsgs.push({
        severity: 'error',
        summary: 'Error!'
      });
    });
  }
  
  /* ---------------------------- ADD AREA ----------------------------*/
  private initAddArea() {
	let formControls = {};
	formControls['username'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(6)]));
	formControls['password'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(6)]));
	formControls['role'] = new FormControl('', Validators.required);
	formControls['email'] = new FormControl('', Validators.compose([Validators.required, Validators.pattern(this.emailPattern)]));
	formControls['firstname'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(32)]));
	formControls['lastname'] = new FormControl('', Validators.compose([Validators.required, Validators.minLength(2), Validators.maxLength(64)]));
	formControls['confirmed'] = new FormControl({value: false, disabled: true}, Validators.nullValidator);
    this.addUserForm = this.fb.group(formControls);
  }
  
  private updateAddArea() {
    
  }
  
  /**
   * this method checks the inputs and create a the user if the inputs are correct
   * 
   * @param data the user inputs
   */
  private checkUserCreation(data) {
	let user = {
	  role: data.role.toString(),
	  userId: "",
	  email: data.email,
	  username: data.username,
	  firstname: data.firstname,
	  lastname: data.lastname,
	  password: data.password,
	  checkedSettings: [],
	  confirmed: data.confirmed
	};
    this.acpS.addUser(user).subscribe(result => {
            //KOPIERT AUS create-user
            const sheetId = uuidv4();
            const dashboardId = uuidv4();
            const projectId = uuidv4();
            const startSheet: SheetDB = new SheetDB(sheetId, 'Sheet 1', []);
            const startDashboard: DashboardDB = new DashboardDB(dashboardId, 'Dashboard 1', [sheetId]);

            this.databaseService.insertDocument(this.databaseService.USERSCOLLECTION, new User(result['userId'], user.role, projectId))
              .subscribe(resultUser => {
                  this.databaseService.insertDocument(this.databaseService.PROJECTSCOLLECTION, new ProjectDB(projectId, 'Project 1', 'omega', [dashboardId]))
                    .subscribe(result => {
                      }
                      , err => {
                      });

                  this.databaseService.insertDocument(this.databaseService.DASHBOARDSCOLLECTION, startDashboard)
                    .subscribe(result => {
                      }
                      , err => {
                      });


                  this.databaseService.insertDocument(this.databaseService.SHEETSSCOLLECTION, startSheet)
                    .subscribe(result => {
                      }
                      , err => {
                      });

                  this.userMsgs.push({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'User has been added!'
                  });
                  this.show('overview');
                },
                err => {
                  this.userMsgs.push({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error while creating user. Please try again later or contact the administrator.'
                  });
                });
          },
          err => {
            if (err.status === CONFLICT) {

               //**
               if(err.getMessage().equals('Email is already registered.')) {
                this.userMsgs.push({severity: 'error', summary: 'Conflict', detail: 'Email address is already registered.'});
              }
              else
                this.userMsgs.push({severity: 'error', summary: 'Conflict', detail: 'Username is already existed.'});

            } else {
              this.userMsgs.push({
                severity: 'error',
                summary: 'Error',
                detail: 'Error while creating user.Please try again later or contact the administrator.'
              });
            }
          });
  }
}
