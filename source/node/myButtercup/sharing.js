const { convertEncryptedContentToHistory } = require("@buttercup/datasources");
const Credentials = require("@buttercup/credentials");
const Share = require("./Share.js");

const ARCHIVE_SHARE_ATTRIBUTE_PREFIX = "BC_SHARE:";

function decryptShareHistory(encryptedContents, password) {
    return convertEncryptedContentToHistory(encryptedContents, Credentials.fromPassword(password));
}

function initialiseShares(workspace) {
    const { archive, datasource } = workspace;
    if (datasource.toObject().type !== "mybuttercup") {
        return Promise.resolve();
    }
    const { client: myButtercupClient } = datasource;
    const archiveAttributes = archive.getAttribute();
    const archiveShares = Object.keys(archiveAttributes)
        .filter(attr => attr.indexOf(ARCHIVE_SHARE_ATTRIBUTE_PREFIX) === 0)
        .reduce((items, attr) => {
            const id = attr.replace(ARCHIVE_SHARE_ATTRIBUTE_PREFIX, "");
            return [...items, { id, password: archiveAttributes[attr] }];
        }, [])
        .filter(shareDetails => !workspace.shares.find(share => share.id === shareDetails.id));
    if (archiveShares.length <= 0) {
        return Promise.resolve();
    }
    return myButtercupClient
        .fetchShares(archiveShares.map(item => item.id))
        .then(shares =>
            shares.map(share =>
                Object.assign(share, {
                    password: archiveShares.find(archiveShare => archiveShare.id === share.id).password
                })
            )
        )
        .then(shares =>
            Promise.all(
                shares.map(share => {
                    return decryptShareHistory(share.contents, share.password)
                        .then(history =>
                            Object.assign(share, {
                                history
                            })
                        )
                        .then(share => {
                            delete share.contents;
                            const sharePerms = ["perm_read", "perm_write", "perm_manage"].filter(
                                perm => share[perm] === true
                            );
                            return new Share(share.id, share.history, sharePerms);
                        });
                })
            )
        );
}

module.exports = {
    initialiseShares
};
