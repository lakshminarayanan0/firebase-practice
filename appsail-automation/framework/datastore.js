const Catalyst = require('zcatalyst-sdk-node');
const Utils = require('./utils.js');
const DSModel = require('./dsmodel.js');

class Datastore
{
	constructor(req, isMock, unAuthenticate)
	{
		this.mock = isMock;
		this.capp = Catalyst.initialize(req);
		this.datastore = this.capp.datastore(); 
		this.zcql = this.capp.zcql();
		this.currentUser = null;
		this.users = null;
		this.unAuthenticate = unAuthenticate;
	}

	getBusiness(orgId)
	{
		return new Promise((resolve, reject) => {
			let query = "SELECT * FROM BUSINESS";
			if(orgId != null)
			{
				query += " WHERE ORG_ID='"+orgId+"'";
			}
			this.selectRecords(new DSModel.Business(), query)
			.then(([records, hasMore]) => {
				resolve(records[0]);
			})
			.catch((error) => {
				Utils.logError(error, "datastore.getBusiness");
				reject(error);
			});
		});
	}

	getRecord(model, id)
	{
		if(id != null)
		{
			let tableId = model.constructor.TABLEID;
			return new Promise((resolve, reject) => {
				this.datastore.table(tableId).getRow(id)
				.then((row) => {
					resolve(model.constructor.fromRow(row));
				})
				.catch((error) => {
					Utils.logError(error, "datastore.getRecord");
					reject(error);
				});
			});
		}
		else
		{
			throw new Error("Record id is null.");
		}
	}

	getRecords(model, limit, offset)
	{
		if(limit == null)
		{
			limit = 100;
		}
		if(offset == null)
		{
			offset = 0;
		}
		let tableId = model.constructor.TABLEID;
		return new Promise((resolve, reject) => {
			this.datastore.table(tableId)
			.getPagedRows({ nextToken: offset, maxRows: limit })
			.then(({ data, next_token, more_records}) => {
				let records = [];
				data.forEach((row) => {
					records.push(model.constructor.fromRow(row));
				});
				resolve(records);
			})
			.catch((error) => {
				Utils.logError(error, "datastore.getRecords");
				reject(error);
			});
		});
	}

	selectRecordsInOrg(model, query, orgId, options, limit, offset)
	{
		if(orgId != null)
		{
			return new Promise((resolve, reject) => {
				this.scopeQueryToOrg(query, orgId)
				.then((query) => {
					if(options != null)
					{
						let { order_by, order } = options;
						if(order_by != null)
						{
							query += ` ORDER BY ${order_by}`;
						}
						if(order != null)
						{
							query += ` ${order}`;
						}
					}
					this.selectRecords(model, query, limit, offset)
					.then(([records, hasMore]) => {
						resolve([records, hasMore]);
					})
					.catch((error) => {
						reject(error);
					});
				})
				.catch((error) => {
					reject(error);
				});
			});
		}
		else
		{
			throw new Error("orgId not provided.");
		}
	}

	scopeQueryToOrg(query, orgId)
	{
		return new Promise((resolve, reject) => {
			if(this.users == null || this.unAuthenticate)
			{
				this.getUsers(orgId)
				.then((users) => {
					resolve(this.setCreatorIdCriteria(query));
				})
				.catch((error) => {
					Utils.logError(error, "datastore.scopeQueryToOrg");
					reject(error);
				});
			}
			else
			{
				resolve(this.setCreatorIdCriteria(query));
			}
		});
	}

	setCreatorIdCriteria(query)
	{
		if(query.includes(DSModel.SQL.WHERE))
		{
			query += DSModel.SQL.AND;
		}
		else
		{
			query += DSModel.SQL.WHERE;
		}
		query += " ( CREATORID IN ( " + Utils.getAsCommaSeparatedString(this.users, "user_id") + " ) )";
		return query;
	}

	selectRecords(model, query, limit, offset)
	{
		if(limit == null || isNaN(limit))
		{
			limit = 201;
		}
		else
		{
			limit = limit + 1;
		}
		if(offset == null || isNaN(offset))
		{
			offset = 0;
		}
		else 
		{
			offset = offset + 1;
		}
		query += DSModel.SQL.LIMIT + offset + "," + limit;
		Utils.logDebug(query, "datastore.selectRecords.query");
		return new Promise((resolve, reject) => {
			this.zcql.executeZCQLQuery(query).then((rows) => {
				let hasMore = true;
				if(rows.length < limit)
				{
					hasMore = false;
				}
				else
				{
					rows.pop();
				}
				let tableName = model.constructor.TABLENAME;
				if(model.constructor.FORM_MODEL)
				{
					tableName = model.getMeta().getTable().name;
				}
				let records = [];
				let childTables = model.constructor.CHILDREN;
				if(model.constructor.FORM_MODEL)
				{
					let childModules = model.getMeta().getSubformModules();
					if(childModules.length > 0)
					{
						childTables = [];
						childModules.forEach((childModule) => {
							childTables.push(childModule.getTable().name);
						});
					}
				}
				if(childTables != null && childTables.length > 0)
				{
					let finalRows = {};
					rows.forEach((row) => {
						let mainRow = row;
						if(row[tableName] != null)
						{
							mainRow = row[tableName];
						}
						if(finalRows[mainRow.ROWID] == null)
						{
							finalRows[mainRow.ROWID] = Object.assign({}, row);
						}
						let finalRow = finalRows[mainRow.ROWID];
						mainRow = finalRow[tableName];
						childTables.forEach((child) => {
							let childRow = row[child];
							if(childRow != null)
							{
								if(mainRow[child] == null)
								{
									mainRow[child] = [];
								}
								if(childRow.ROWID != null)
								{
									if(model.constructor.COLUMNINCHILDREN != null)
									{
										delete childRow[model.constructor.COLUMNINCHILDREN];
									}
									mainRow[child].push(row[child]);
								}
							}
						});
					});
					rows = Object.values(finalRows);
				}
				rows.forEach((row) => {
					let meta;
					if(model.getMeta)
					{
						meta = model.getMeta();
					}
					records.push(model.constructor.fromRow(row, meta));
				});
				resolve([records, hasMore]);
			})
			.catch((error) => {
				Utils.logError(error, "datastore.selectRecords");
				reject(error);
			});
		});
	}

	executeSelectQuery(query, tableName)
	{
		return new Promise((resolve, reject) => {
			Utils.logDebug(query, "datastore.executeSelectQuery");
			this.zcql.executeZCQLQuery(query).then((response) => {
				const rows = [];
				if(Utils.isValidArray(response))
				{
					response.forEach((row) => {
						if(tableName && row[tableName])
						{
							row = row[tableName];
						}
						rows.push(row);
					});
				}
				resolve(rows);
			})
			.catch((error) => {
				reject(error);
			});
		});
	}

	executeUpdateQuery(query)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(query, "datastore.dummy.update.query");
				resolve(true);
			}
			else
			{
				Utils.logDebug(query, "datastore.executeUpdateQuery");
				this.zcql.executeZCQLQuery(query).then((updatedRows) => {
					resolve(true);
				})
					.catch((error) => {
						Utils.logError(error, "datastore.executeUpdateQuery");
						reject(error);
					});
			}
		});
	}

	executeDeleteQuery(query)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(query, "datastore.dummy.executeDeleteQuery");
				resolve(true);
			}
			else
			{
				Utils.logDebug(query, "datastore.executeDeleteQuery");
				this.zcql.executeZCQLQuery(query).then((response) => {
					resolve(response);
				})
					.catch((error) => {
						Utils.logError(error, "datastore.executeDeleteQuery");
						reject(error);
					});
			}
		});
	}

	insertRecords(records)
	{
		if(records != null && records.length > 0)
		{
			let tableId = records[0].constructor.TABLEID;
			let tableName = records[0].constructor.TABLENAME;
			if(records[0].constructor.FORM_MODEL)
			{
				tableId = records[0].getMeta().getTable().id;
				tableName = records[0].getMeta().getTable().name;
			}
			let rows = [];
			records.forEach((record) => {
				rows.push(record.getAsRow());
			});
			return new Promise((resolve, reject) => {
				if(this.mock)
				{
					let insertedRecords = [];
					rows.forEach((newRow) => {
						newRow.ROWID = tableName + "_" + Date.now();
						let module;
						if(records[0].constructor.FORM_MODEL)
						{
							module = records[0].getMeta();
						}
						insertedRecords.push(records[0].constructor.fromRow(newRow, module));
					});
					Utils.logInfo(rows, "dummy insert success for " + tableName + " rows");
					resolve(insertedRecords);
				}
				else
				{
					Utils.logDebug(rows, "datastore.insertRecords");
					this.datastore.table(tableId).insertRows(rows)
						.then((newRows) => {
						let insertedRecords = [];
						newRows.forEach((newRow) => {
							let module;
							if(records[0].constructor.FORM_MODEL)
							{
								module = records[0].getMeta();
							}
							insertedRecords.push(records[0].constructor.fromRow(newRow, module));
						});
						resolve(insertedRecords);
					})
					.catch((error) => {
						Utils.logError(error, "datastore.insertRecords");
						reject(error);
					});
				}
			});
		}
		else
		{
			throw new Error("No records found.");
		}
	}

	updateRecords(records)
	{
		if(records != null && records.length > 0)
		{
			let tableId = records[0].constructor.TABLEID;
			let tableName = records[0].constructor.TABLENAME;
			if(records[0].constructor.FORM_MODEL)
			{
				tableId = records[0].getMeta().getTable().id;
				tableName = records[0].getMeta().getTable().name;
			}
			let rows = [];
			records.forEach((record) => {
				rows.push(record.getAsRow());
			});
			return new Promise((resolve, reject) => {
				if(this.mock)
				{
					let updatedRecords = [];
					rows.forEach((newRow) => {
						newRow.MODIFIEDTIME = tableName + "_" + Date.now();
						let module;
						if(records[0].constructor.FORM_MODEL)
						{
							module = records[0].getMeta();
						}
						updatedRecords.push(records[0].constructor.fromRow(newRow, module));
					});
					Utils.logInfo(rows, "datastore.dummy.updateRecords");
					resolve(updatedRecords);
				}
				else
				{
					Utils.logDebug(rows, "actual update query for " + tableName + " rows");
					this.datastore.table(tableId).updateRows(rows)
					.then((updatedRows) => {
						let updatedRecords = [];
						updatedRows.forEach((updatedRow) => {
							let module;
							if(records[0].constructor.FORM_MODEL)
							{
								module = records[0].getMeta();
							}
							updatedRecords.push(records[0].constructor.fromRow(updatedRow, module));
						});
						resolve(updatedRecords);
					})
					.catch((error) => {
						Utils.logError(error, "datastore.updateRecords");
						reject(error);
					});
				}
			});
		}
		else
		{
			throw new Error("No records found.");
		}
	}

	insertRecordsInOrg(records, superAdminId)
	{
		return new Promise((resolve, reject) => {
			this.insertRecords(records)
			.then((newRecords) => {
				let updateRecords = [];
				newRecords.forEach((newRecord) => {
					let meta = null;
					if(typeof newRecord.getMeta == "function")
					{
						meta = newRecord.getMeta();
					}
					let recordToUpdate = {
						ROWID: newRecord.id,
						CREATORID: superAdminId
					};
					updateRecords.push(newRecord.constructor.fromRow(recordToUpdate, meta));
				});
				this.updateRecords(updateRecords)
				.then((updatedRecords) => {
					resolve(updatedRecords);
				})
				.catch((error) => {
					Utils.logError(error, "datastore.insertRecordsInOrg.update");
					reject(error);
				});
			})
			.catch((error) => {
				Utils.logError(error, "datastore.insertRecordsInOrg");
				reject(error);
			});
		});
	}

	deleteRecord(record)
	{
		if(record != null)
		{
			let row = record.getAsRow();
			let tableId = record.constructor.TABLEID;
			if(record.constructor.FORM_MODEL)
			{
				tableId = record.getMeta().getTable().id;
			}
			return new Promise((resolve, reject) => {
				if(this.mock)
				{
					Utils.logDebug(record, "datastore.dummy.deleteRecord");
					resolve(true);
				}
				else
				{
					Utils.logDebug(record, "datastore.deleteRecord");
					this.datastore.table(tableId).deleteRow(row.ROWID)
					.then((status) => {
						resolve(status);
					})
					.catch((error) => {
						Utils.logError(error, "datastore.deleteRecord");
						reject(error);
					});
				}
			});
		}
		else
		{
			throw new Error("No record passed.");
		}
	}

	deleteRows(query)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(query, "datastore.dummy.deleteRows");
				resolve(true);
			}
			else
			{
				Utils.logDebug(query, "datastore.deleteRows");
				this.zcql.executeZCQLQuery(query).then((status) => {
					resolve(true);
				})
				.catch((error) => {
					Utils.logError(error, "datastore.deleteRows");
					reject(error);
				});
			}
		});
	}

	getAllAdmins(orgId)
	{
		return new Promise((resolve, reject) => {
			this.getUsers(orgId).then((users) => {
				let admins = users.filter((user) => user.role?.name === "Administrator");
				resolve(admins);
			})
			.catch((error) => {
				reject(error);
			});
		});
	}

	getUsers(orgId)
	{
		return new Promise((resolve, reject) => {
			if(this.users != null && !this.unAuthenticate)
			{
				resolve(this.users);
			}
			else
			{
				if(orgId == null)
				{
					this.getCurrentUser()
					.then((currentUser) => {
						if(currentUser == null)
						{
							reject(new Error("Unintended unauthorized access.", {cause: {code: "UNAUTHORIZED"}}));
						}
						else
						{
							this.actuallyGetUsers(currentUser.org_id, resolve, reject);
						}
					})
					.catch((error) => {
						Utils.logError(error, "datastore.getUsers.2");
						reject(error);
					});
				}
				else 
				{
					this.actuallyGetUsers(orgId, resolve, reject);
				}
			}
		});
	}

	actuallyGetUsers(orgId, resolve, reject)
	{
		this.capp.userManagement().getAllUsers(orgId)
		.then((userRows) => 
		{
			let users = [];
			userRows.forEach((user) => {
				users.push(DSModel.User.fromRow(user));
			});
			this.users = users;
			resolve(users);
		})
		.catch((error) => {
			Utils.logError(error, "datastore.actuallyGetUsers");
			reject(error);
		});
	}

	getCurrentUser()
	{
		return new Promise((resolve, reject) => {
			if(this.currentUser != null)
			{
				resolve(this.currentUser);
			}
			else
			{
				this.capp.userManagement().getCurrentUser()
				.then((cUserRow) => 
				{
					if(cUserRow != null)
					{
						let currentUser = DSModel.User.fromRow(cUserRow);
						this.currentUser = currentUser;
						resolve(currentUser);
					}
					else
					{
						resolve(null);
					}
				})
				.catch((error) => {
					Utils.logError(error, "datastore.getCurrentUser");
					reject(error);
				});
			}
		});
	}

	getUser(id)
	{
		return new Promise((resolve, reject) => {
			this.capp.userManagement().getUserDetails(id)
			.then((userRow) => 
			{
				if(userRow != null)
				{
					let user = DSModel.User.fromRow(userRow);
					resolve(user);
				}
				else
				{
					resolve(null);
				}
			})
			.catch((error) => {
				if(typeof error == 'string' && error.includes("INVALID_ID") || (typeof error === "object" && error.code === "INVALID_ID"))
				{
					resolve(null);
				}
				else
				{
					Utils.logError(error, "datastore.getUser");
					reject(error);
				}
			});
		});
	}

	addUser(business, user, signupConfig)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(JSON.stringify(user), "datastore.dummy.addUser");
				user.user_id = "USER_ID_" + Date.now();
				resolve(user);
			}
			else
			{
				var userConfig = { first_name: user.first_name, last_name: user.last_name, email_id: user.email, org_id: business.org_id};
				if(user.role != null)
				{
					userConfig.role_id = user.role.id;
				}
				this.capp.userManagement().addUserToOrg(signupConfig, userConfig)
				.then((signupRow) => {
					let addedUser = DSModel.User.fromRow(signupRow.user_details);
					resolve(addedUser);
				})
				.catch((error) => {
					if(typeof error == 'string' && error.includes("DUPLICATE_VALUE"))
					{
						reject(new Error("User already present.", {cause: {code: "NOT_ALLOWED", reason: "DUPLICATE_USER"}}));
					}
					else
					{
						Utils.logError(error, "datastore.addUser");
						reject(error);
					}
				});
			}
		});
	}

	updateUser(user)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(JSON.stringify(user), "datastore.dummy.updateUser");
				resolve(user);
			}
			else
			{
				this.capp.userManagement().updateUserDetails(user.user_id, user.getAsRow())
				.then((userRow) => 
				{
					let updatedUser = DSModel.User.fromRow(userRow);
					resolve(updatedUser);
				})
				.catch((error) => {
					Utils.logError(error, "datastore.updateUser");
					reject(error);
				});
			}
		});
	}

	updateUserStatus(user)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(JSON.stringify(user), "datastore.dummy.updateUserStatus");
				resolve(user);
			}
			else
			{
				let status = "enable";
				if(user.status == "inactive")
				{
					status = "disable";
				}
				this.capp.userManagement().updateUserStatus(user.user_id, status)
				.then((userRow) => 
				{
					let updatedUser = DSModel.User.fromRow(userRow);
					resolve(updatedUser);
				})
				.catch((error) => {
					Utils.logError(error, "datastore.updateUserStatus");
					reject(error);
				});
			}
		});
	}

	deleteUser(user)
	{
		return new Promise((resolve, reject) => {
			if(this.mock)
			{
				Utils.logInfo(user.user_id, "datastore.dummy.deleteUser");
				resolve(true);
			}
			else
			{
				this.capp.userManagement().deleteUser(user.user_id)
				.then((deletedUser) => 
				{
					resolve(true);
				})
				.catch((error) => {
					Utils.logError(error, "datastore.deleteUser");
					reject(error);
				});
			}
		});
	}

	getAllOrgs()
	{
		return new Promise((resolve, reject) => {
			this.capp.userManagement().getAllOrgs()
			.then((orgs) => {
				resolve(orgs);
			})
			.catch((error) => {
				Utils.logError(error, "datastore.getAllOrgs");
				reject(error);
			});
		});
	}

	sendNotification(notification, userIds)
	{
		if(!this.mock)
		{
			return this.capp.pushNotification().web().sendNotification(JSON.stringify(JSON.stringify(notification)), userIds);
		}
		else
		{
			return Promise.resolve();
		}
	}
}
module.exports = Datastore;