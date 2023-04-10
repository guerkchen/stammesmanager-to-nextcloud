const verbandonline = require("verbandonline-node-api");
const nextcloud = require('nextcloud-node-client');
const dotenv = require('dotenv');
const config = require('config');
const winston = require('winston');

dotenv.config();

var logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({'timestamp': true}),
    ],
});

verbandonline.setVerbandsUrl(config.get('url.stammesmanager'));
verbandonline.setToken(process.env.verbandonline_adminuser, process.env.verbandonline_adminpassword);

const nextcloudServer = new nextcloud.Server({
    basicAuth: { 
            username: process.env.nextcloud_adminuser,
            password: process.env.nextcloud_adminpassword,
        },
        url: config.get('url.nextcloud'),
});
const nextcloudClient = new nextcloud.Client(nextcloudServer);

function getDisplayName(stama_res){
    if(stama_res.hasOwnProperty("key_pfadfindername") && stama_res["key_pfadfindername"].trim() != ""){
        return stama_res["key_pfadfindername"].trim();
    } else if(stama_res.hasOwnProperty("vorname") && stama_res["vorname"].trim() != "" && 
                stama_res.hasOwnProperty("nachname") && stama_res["nachname"].trim() != ""){
        return stama_res["vorname"].trim() + " " + stama_res["nachname"].trim();
    } else {
        return stama_res["userlogin"];
    }
}

exports.setLogger = function(_logger){
    logger = _logger;
}

/**
 * 
 * @param {string} usr Loginname der Person beim Stammesmanager (wird auch der Nextcloud Login)
 * @param {string} pwd Passwort der Person beim Stammesmanager (wird auch der Nextlcoud Login)
 * @param {int} id ID der Person beim Stammesmanager. Wird für die Gruppenabfrage genutzt.
 * @param {callback function(string)} res Callback, wird nur bei Erfolg gerufen
 * @param {callback function(string)} err Error, wird nur bei Error gerufen
 */
exports.transferUserToNextcloud = async function(usr, pwd, id, res, err){
    logger.verbose("enter transferUserToNextcloud(" + usr + ", ***, " + id + ")");

    const user = await nextcloudClient.getUser(usr);
    logger.debug("nextcloudClient got user " + user);
    if(user){
        // Es gibt den Nutzer bereits, deswegen ändern wir nur das Passwort
        logger.info("user " + usr + " already exists, so update the password");
        user.setPassword(pwd);
        res("Der Nutzer " + usr + " existiert bereits. Das Passwort wurde angepasst.");

    } else {
        verbandonline.GetMember(id, async stama_res => {
            logger.info("Create new Nextcloud User " + usr + ", email: ${stama_res.p_email}");
            
            const newUser = await nextcloudClient.createUser({"id": usr, "email": stama_res.p_email, "password": pwd, });
            newUser.setDisplayName(getDisplayName(stama_res));
            newUser.setQuota("1 GB");
            newUser.setLanguage("de");

            res("Nextcloudnutzer " + usr + " wurde erfolgreich angelegt.");
        }, stama_err => {
            logger.error("Informationen für den Nutzer ${usr} mit der ID ${id} konnten nicht abgerufen werden");
            err("Informationen für den Nutzer ${usr} mit der ID ${id} konnten nicht abgerufen werden");
        });
    }
}