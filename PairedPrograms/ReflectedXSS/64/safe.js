import _ from 'lodash';
import escape from 'escape-html';

import Controller from '../base/controller';
import inputSanitizer from '../utilities/inputSanitizer';
import urlValidator from '../utilities/urlValidator';
import { filtersService } from '../filters/dependency';
import helper from '../utilities/helper.util';
import { Collections } from '../collections/collections.model';
import { Data } from '../tool/data.model';
import { ROLES } from '../user/user.roles';
import { MessagesModel } from '../message/message.model';
import { UserModel } from '../user/user.model';

export default class CollectionsController extends Controller {
	constructor(collectionsService) {
		super(collectionsService);
		this.collectionsService = collectionsService;
	}

	async getList(req, res) {
		let role = req.user.role;
		let startIndex = 0;
		let limit = 40;
		let searchString = '';
		let status = 'all';

		if (req.query.offset) {
			startIndex = req.query.offset;
		}
		if (req.query.limit) {
			limit = req.query.limit;
		}
		if (req.query.q) {
			searchString = req.query.q || '';
		}
		if (req.query.status) {
			status = req.query.status;
		}

		if (role === ROLES.Admin) {
			try {
				const data = await this.collectionsService.getCollectionsAdmin(searchString, status, startIndex, limit);
				return res.json({ success: true, data: data });
			} catch (err) {
				return res.json({ success: false, error: err });
			}
		} else if (role === ROLES.Creator) {
			try {
				let idString = req.user.id;
				if (req.query.id) {
					idString = req.query.id;
				}
				const data = await this.collectionsService.getCollections(idString, status, startIndex, limit);
				return res.json({ success: true, data: data });
			} catch (err) {
				return res.json({ success: false, error: err });
			}
		}
	}

	async getCollection(req, res) {
		let collectionID = parseInt(req.params.collectionID);

		try {
			const data = await this.collectionsService.getCollection(collectionID);
			if (_.isEmpty(data)) {
				return res.status(404).send(`Collection not found for ID: ${escape(collectionID)}`);
			}
			data[0].persons = helper.hidePrivateProfileDetails(data[0].persons);
			return res.json({ success: true, data: data });
		} catch (err) {
			return res.json({ success: false, error: err });
		}
	}

	async getCollectionRelatedResources(req, res) {
		let collectionID = parseInt(req.params.collectionID);

		try {
			const data = await this.collectionsService.getCollectionObjects(collectionID);
			return res.json({ success: true, data: data });
		} catch (err) {
			return res.json({ success: false, error: err });
		}
	}

	async getCollectionByEntity(req, res) {
		let entityID = req.params.entityID;
		let dataVersions = await Data.find({ pid: entityID }, { _id: 0, datasetid: 1 });
		let dataVersionsArray = dataVersions.map(a => a.datasetid);
		dataVersionsArray.push(entityID);

		try {
			const data = await this.collectionsService.getCollectionByEntity(entityID, dataVersionsArray);
			return res.json({ success: true, data: data });
		} catch (err) {
			res.json({ success: false, error: err });
		}
	}

	async editCollection(req, res) {
		let collectionID = parseInt(req.params.id);
		let { name, description, imageLink, authors, relatedObjects, publicflag, keywords, previousPublicFlag, collectionCreator } = req.body;
		imageLink = urlValidator.validateURL(imageLink);

		let updatedCollection = { name, description, imageLink, authors, relatedObjects, publicflag, keywords };

		try {
			await this.collectionsService.editCollection(collectionID, updatedCollection);
			filtersService.optimiseFilters('collection');
			await Collections.find({ id: collectionID }, { publicflag: 1, id: 1, activeflag: 1, authors: 1, name: 1 }).then(async res => {
				if (previousPublicFlag === false && publicflag === true) {
					await this.collectionsService.sendEmailNotifications(res[0], res[0].activeflag, collectionCreator, true);

					if (res[0].authors) {
						res[0].authors.forEach(async authorId => {
							await this.createMessage(authorId, res[0], res[0].activeflag, collectionCreator, true);
						});
					}

					await this.createMessage(0, res[0], res[0].activeflag, collectionCreator, true);
				}
			});
			return res.json({ success: true });
		} catch (err) {
			return res.json({ success: false, error: err });
		}
	}

	async addCollection(req, res) {
		let collections = new Collections();
		const collectionCreator = req.body.collectionCreator;
		const { name, description, imageLink, authors, relatedObjects, publicflag, keywords } = req.body;

		collections.id = parseInt(Math.random().toString().replace('0.', ''));
		collections.name = inputSanitizer.removeNonBreakingSpaces(name);
		collections.description = inputSanitizer.removeNonBreakingSpaces(description);
		collections.imageLink = imageLink;
		collections.authors = authors;
		collections.relatedObjects = relatedObjects;
		collections.activeflag = 'active';
		collections.publicflag = publicflag;
		collections.keywords = keywords;
		collections.updatedon = Date.now();

		if (collections.authors) {
			collections.authors.forEach(async authorId => {
				await this.createMessage(authorId, collections, collections.activeflag, collectionCreator);
			});
		}

		await this.createMessage(0, collections, collections.activeflag, collectionCreator);

		await this.collectionsService.sendEmailNotifications(collections, collections.activeflag, collectionCreator);

		try {
			await this.collectionsService.addCollection(collections);
			res.json({ success: true, id: collections.id });
		} catch (err) {
			res.json({ success: false, error: err });
		}
	}

	async changeStatus(req, res) {
		const collectionID = parseInt(req.params.id);
		let { activeflag } = req.body;
		activeflag = activeflag.toString();

		try {
			await this.collectionsService.changeStatus(collectionID, activeflag);
			filtersService.optimiseFilters('collection');
			return res.json({ success: true });
		} catch (err) {
			return res.json({ success: false, error: err });
		}
	}

	async deleteCollection(req, res) {
		const collectionID = parseInt(req.params.id);
		try {
			await this.collectionsService.deleteCollection(collectionID);
			res.json({ success: true });
		} catch (err) {
			res.json({ success: false, error: err });
		}
	}

	async createMessage(authorId, collections, activeflag, collectionCreator, isEdit) {
		let message = new MessagesModel();

		const messageRecipients = await UserModel.find({ $or: [{ role: 'Admin' }, { id: { $in: collections.authors } }] });
		async function saveMessage() {
			message.messageID = parseInt(Math.random().toString().replace('0.', ''));
			message.messageTo = authorId;
			message.messageObjectID = collections.id;
			message.messageSent = Date.now();
			message.isRead = false;
			await message.save();
		}

		if (authorId === 0) {
			message.messageType = 'added collection';
			message.messageDescription = this.collectionsService.generateCollectionEmailSubject(
				'Admin',
				collections.publicflag,
				collections.name,
				false,
				isEdit
			);
			saveMessage();
		}

		for (let messageRecipient of messageRecipients) {
			if (activeflag === 'active' && authorId === messageRecipient.id) {
				message.messageType = 'added collection';
				message.messageDescription = this.collectionsService.generateCollectionEmailSubject(
					'Creator',
					collections.publicflag,
					collections.name,
					authorId === collectionCreator.id ? true : false,
					isEdit
				);
				saveMessage();
			}
		}
	}
}
