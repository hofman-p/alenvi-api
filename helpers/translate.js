module.exports = {
  language: 'fr-FR',
  'en-EN': {
    /* Global errors */
    missingParameters: 'Missing parameters :(',
    unexpectedBehavior: 'Unexpected behavior.',
    /* Token errors */
    tokenAuthFailed: 'Failed to authenticate token.',
    tokenExpired: 'Token is expired.',
    tokenNotFound: 'Please provide a token.',
    /* Users strings */
    userExists: 'User already exists.',
    usersNotFound: 'There are no users.',
    userNotFound: "User doesn't exist.",
    userEmailExists: 'This email is already taken by another user.',
    invalidEmail: 'Email is not valid.',
    userFound: 'User found successfully.',
    userSectorsFound: 'User sectors found successfully.',
    usersFound: 'Users found successfully.',
    userSaved: 'User saved successfully.',
    userRemoved: 'User removed successfully.',
    userUpdated: 'User updated successfully.',
    userAddressStored: 'User address stored successfully.',
    userAddressNotFound: 'User address not found',
    userAuthNotFound: 'Authentication failed because the user was not found.',
    userAuthFailed: 'The email address or password you entered is not valid.',
    forbidden: 'Forbidden.',
    userAuthentified: 'User authenticated successfully.',
    /* Ogust */
    OgustGetTokenOk: 'Ogust Token well retrieved.',
    OgustGetTokenFailed: 'Ogust Token retrieving failed.',
    servicesFound: 'Ogust services found.',
    servicesNotFound: 'Ogust services not found.',
    serviceFound: 'Ogust service found.',
    serviceNotFound: 'Ogust service not found.',
    serviceUpdated: 'Ogust service updated.',
    thirdPartyInfoNotFound: 'Ogust third party information not found.',
    thirdPartyInfoFound: 'Ogust third party information retrieving failed.',
    thirdPartyInfoEdited: 'Ogust third party information edited successully.',
    salariesNotFound: 'Ogust employee\'s salaries not found.',
    salariesFound: 'Ogust employee\'s found.',
    facebookGetWhitelistedDomainsOk: 'Facebook whitelisted domains found.',
    facebookPostWhitelistedDomainsOk: 'Facebook whitelisted domain(s) added.',
    facebookNoToken: 'Facebook Token not provided.',
    blogGetRssFeedsOk: 'Rss feed found.',
    blogGetRssFeedsNoUrl: 'URL not provided.',
    customerCodesEdited: 'Ogust customer codes edited successfully',
    fiscalAttestsFound: 'Customer fiscal attestations found.',
    fiscalAttestsNotFound: 'Customer fiscal attestations not found.',
    invoicesFound: 'Customer invoices found.',
    invoicesNotFound: 'Customer invoices not found.',
    bankInfoFound: 'Bank info found.',
    bankInfoUpdated: 'Bank info updated.',
    employmentContractShowAllFound: 'Employment contracts found.',
    employmentContractFound: 'Employment contract found.',
    employmentContractCreated: 'Employment contract created.',
    employmentContractSaved: 'Employment contract saved.',
    addressUpdated: 'Address successfully updated.',
    sepaInfoFound: 'Sepa info found.',
    sepaInfoUpdated: 'Sepa info updated.',
    sepaInfoCreated: 'Sepa info created.',
    /* Messages */
    getAllMessagesFound: 'Messages found successfully.',
    getAllMessagesNotFound: 'Messages not found.',
    messageNotFound: 'Message not found.',
    storeMessage: 'Message successfully stored.',
    messageRecipientAdded: 'Message recipient added successfully.',
    /* Planning modifications */
    planningModificationsFound: 'Planning modifications found.',
    planningModificationsNotFound: 'Planning moddifications not found.',
    planningModificationStored: 'Planning modification stored successfully.',
    planningModificationUpdated: 'Planning modification updated successfully.',
    planningModificationDeleted: 'Planning modification deleted successfully.',
    /* SMS */
    smsNotSent: 'SMS not sent.',
    smsSent: 'SMS well sent.',
    smsListFound: 'SMS record list found.',
    /* Activation Code */
    activationCodeCreated: 'Activation code created.',
    activationCodeNotFoundOrInvalid: 'Activation code not found or invalid.',
    activationCodeValidated: 'Activation code validated.',
    refreshTokenNotFound: 'Refresh token not found.',
    activationCodeDeleted: 'Activation data deleted.',
    /* Role */
    roleCreated: 'Role created.',
    roleDeleted: 'Role deleted.',
    roleUpdated: 'Role updated.',
    rolesNotFound: 'Roles not found.',
    rolesFound: 'Roles found.',
    roleNotFound: 'Role not found',
    roleExists: 'Role already exists.',
    roleRemoved: 'Role removed.',
    /* Right */
    rightCreated: 'Right created.',
    rightDeleted: 'Right deleted.',
    rightUpdated: 'Right updated.',
    rightsFound: 'Rights found',
    rightsNotFound: 'Rights not found.',
    rightNotFound: 'Right not found',
    rightExists: 'Right already exists.',
    rightsDoNotExist: 'Rights do not exist.',
    rightRemoved: 'Right removed.',
    /* Email */
    emailSent: 'Email successfully sent.',
    /* Reset password token */
    resetPasswordTokenFound: 'Reset password token found.',
    resetPasswordTokenNotFound: 'Reset password token not found.',
    /* ID number */
    idNumberCreated: 'ID number successfully created.',
    /* Uploader */
    fileNotFound: 'File not found.',
    fileFound: 'File found.',
    fileDeleted: 'File Deleted',
    folderCreated: 'Folder successfully created.',
    folderCreationFailure: 'Folder creation Failed.',
    fileCreated: 'File successfully created.',
    uploadNotAllowed: 'Upload not allowed',
    /* Company */
    companiesFound: 'Companies found.',
    companyFound: 'Company found.',
    companyNotFound: 'Company not found',
    companyCreated: 'Company created.',
    companyDeleted: 'Company deleted.',
    companyExists: 'Company already exists.',
    companyServicesFound: 'Company services found.',
    companyServiceCreated: 'Company service created.',
    companyServiceDeleted: 'Company service deleted.',
    companyServicesNotFound: 'Company services not found.',
    companyServiceNotFound: 'Company service not found.',
    companyServicesUpdated: 'Company services updated.',
    companyInternalHourCreated: 'Company internal hour created',
    companyInternalHourNotFound: 'Company internal hour not found.',
    companyInternalHourUpdated: 'Company internal hour updated.',
    companyInternalHoursNotFound: 'Company internal hours not found.',
    companyInternalHoursFound: 'Company internal hours found.',
    companyInternalHourRemoved: 'Company internal hour removed.',
    companyInternalHourCreationNotAllowed: 'Company internal hour creation not allowed',
    companyInternalHourDeletionNotAllowed: 'Company internal hour deletion not allowed',
    companyThirdPartyPayerCreated: 'Company third party payer created.',
    companyThirdPartyPayersFound: 'Company third party payers found.',
    companyThirdPartyPayersNotFound: 'Company third party payers not found.',
    companyThirdPartyPayerUpdated: 'Company third party payer updated.',
    companyThirdPartyPayerDeleted: 'Company third party payer deleted.',
    companySectorCreated: 'Company sector created.',
    /* User contracts */
    userContractsFound: 'User contracts found.',
    userContractUpdated: 'User contract updated.',
    userContractAdded: 'User contract added.',
    userContractRemoved: 'User contract removed.',
    /* User contracts amendments */
    userContractVersionAdded: 'User contract amendment added.',
    userContractVersionRemoved: 'User contract amendment removed.',
    userContractVersionUpdated: 'User contract amendment updated.',
    /* User absences */
    userAbsencesFound: 'User contracts found.',
    userAbsenceUpdated: 'User contract updated.',
    userAbsenceAdded: 'User contract added.',
    userAbsenceRemoved: 'User contract removed.',
    /* User tasks */
    userTasksFound: 'User tasks found',

    /* Customers */
    customersFound: 'Customers found.',
    customerFound: 'Customer found.',
    customerNotFound: 'Customer not found.',
    customerCreated: 'Customer created.',
    customerUpdated: 'Customer updated.',
    customerRemoved: 'Customer removed',
    customerHelperDeleted: 'Customer helper deleted.',
    customerSubscriptionsFound: 'Customer subscriptions found',
    customerSubscriptionsNotFound: 'Customer subscriptions not found',
    customerSubscriptionAdded: 'Customer subscription added',
    customerSubscriptionUpdated: 'Customer subscription updated',
    customerSubscriptionRemoved: 'Customer subscription removed',
    serviceAlreadySubscribed: 'Service already subscribed',
    customerMandateUpdated: 'Customer mandate updated',
    customerMandatesFound: 'Customer mandates found',
    customerMandateNotFound: 'Customer mandate not found',
    customerQuotesFound: 'Customer quotes found.',
    customerQuoteAdded: 'Customer quote added.',
    customerQuoteRemoved: 'Customer quote removed.',
    signedDocumentSaved: 'Signed document saved.',
    customerSubscriptionHistoryAdded: 'Customer subscription history added.',
    customerFundingConflict: 'Subscription is already used by another funding.',
    customerFundingNotFound: 'Customer funding not found.',
    customerFundingCreated: 'Customer funding created.',
    customerFundingUpdated: 'Customer funding updated.',
    customerFundingsFound: 'Customer fundings found.',
    customerFundingRemoved: 'Customer funding removed.',

    /* ESign */
    signatureRequestCreated: 'Signature request created.',
    documentNotFound: 'Eversign document not found.',
    documentFound: 'Eversign document found.',

    /* Google drive */
    googleDriveFolderCreationFailed: 'Google drive folder creation failed.',
    googleDriveFolderNotFound: 'Google drive folder not found.',
    googleDriveFileNotFound: 'Google drive file not found.',

    /* Events */
    eventsNotFound: 'Events not found',
    eventNotFound: 'Event not found',
    eventsFound: 'Event found',
    eventCreated: 'Event created',
    eventUpdated: 'Event updated',
    eventDeleted: 'Event deleted',

    /* Google Map */
    distanceMatrixFound: 'Distance Matrix found',
    distanceMatrixNotFound: 'Distance Matrix not found',

    /* Task */
    taskFound: 'Tasks found',
    taskNotFound: 'Tasks non found',
    tasksFound: 'Taskss found',
    tasksNotFound: 'Taskss non found',
    taskCreated: 'Tasks created',
    taskUpdated: 'Tasks updated',
    taskDeleted: 'Tasks deleted',
  },
  'fr-FR': {
    /* Global errors */
    missingParameters: 'Paramètres manquants :(',
    unexpectedBehavior: 'Comportement inattendu.',
    /* Token errors */
    tokenAuthFailed: "Impossible d'authentifier le token.",
    tokenExpired: 'Le token a expiré.',
    tokenNotFound: 'Merci de fournir un token.',
    /* Users strings */
    userExists: "L'utilisateur existe déjà.",
    usersNotFound: "Il n'y a aucun utilisateur.",
    userNotFound: "L'utilisateur n'existe pas.",
    userEmailExists: 'Cet email est déjà pris par un autre utilisateur.',
    invalidEmail: "L'email n'est pas valide.",
    userSaved: 'Utilisateur enregistré avec succès.',
    usersFound: 'Utilisateurs trouvés avec succès.',
    userSectorsFound: 'Communautés trouvés avec succès.',
    userFound: 'Utilisateur trouvé avec succès.',
    userRemoved: 'Utilisateur supprimé avec succès.',
    userUpdated: 'Utilisateur modifié avec succès.',
    userAddressStored: 'Adresse utilisateur enregistré avec succès',
    userAddressNotFound: "Adresse utilisateur n'existe pas.",
    userAuthNotFound: "L'authentification a échoué car l'utilisateur n'existe pas.",
    userAuthFailed: "L'adresse email ou le mot de passe est invalide.",
    forbidden: 'Accès non autorisé.',
    userAuthentified: 'Utilisateur authentifié avec succès.',
    /* Ogust */
    OgustGetTokenOk: 'Token Ogust reçu avec succès.',
    OgustGetTokenFailed: 'Problème lors de la récupération du Token Ogust.',
    servicesFound: 'Services Ogust reçus avec succès.',
    servicesNotFound: 'Services Ogust non trouvés.',
    serviceFound: 'Service Ogust reçu avec succès.',
    serviceNotFound: 'Service Ogust non trouvé.',
    serviceUpdated: 'Service Ogust mis à jour',
    thirdPartyInfoNotFound: 'La récupération des informations tierces a échoué.',
    thirdPartyInfoFound: 'Informations tierces récupérées avec succès.',
    thirdPartyInfoEdited: 'Informations tierces éditées avec succès.',
    salariesNotFound: 'Echec lors de la récupération des bulletins de salaire de l\'employé.',
    salariesFound: 'Bulletins de salaire de l\'employé trouvés avec succès.',
    facebookGetWhitelistedDomainsOk: 'Domains whitelistés Facebook récupérés avec succès.',
    facebookPostWhitelistedDomainsOk: 'Domaine(s) whitelisté(s) ajoutés avec succès.',
    facebookNoToken: 'Merci de fournir un token d\'accès de page Facebook.',
    blogGetRssFeedsOk: 'Flux Rss trouvé avec succès.',
    blogGetRssFeedsNoUrl: 'URL manquante',
    customerCodesEdited: 'Codes bénéficiaires edités avec succès.',
    fiscalAttestsFound: 'Attestations fiscales du bénéficiaire trouvées.',
    fiscalAttestsNotFound: 'Attestations fiscales du bénéficiaire non trouvées',
    invoicesFound: 'Factures bénéficiaire trouvées.',
    invoicesNotFound: 'Factures bénéficiaire non trouvées.',
    bankInfoFound: 'Informations bancaires trouvées.',
    bankInfoUpdated: 'Informations bancaires mises à jour.',
    employmentContractShowAllFound: "Contrats d'embauche trouvés.",
    employmentContractFound: "Contrat d'embauche trouvé.",
    employmentContractCreated: "Contrat d'embauche créé.",
    employmentContractSaved: "Contrat d'embauche enregistré.",
    addressUpdated: 'Adresse éditée avec succès.',
    sepaInfoFound: 'Informations sepa trouvées.',
    sepaInfoUpdated: 'Informations sepa mises à jour.',
    sepaInfoCreated: 'Informations sepa créées.',
    /* Messages */
    getAllMessagesFound: 'Messages trouvés avec succès.',
    getAllMessagesNotFound: 'Pas de messages.',
    messageNotFound: 'Message non trouvé.',
    storeMessage: 'Message enregistré avec succès.',
    messageRecipientUpdated: 'Destinataire message ajouté avec succès.',
    /* Planning modifications */
    planningModificationsFound: 'Modifications planning trouvées.',
    planningModificationsNotFound: 'Pas de modifications planning.',
    planningModificationStored: 'Modification planning enregistré avec succès.',
    planningModificationUpdated: 'Modification planning mise a jour avec succès.',
    planningModificationDeleted: 'Modification planning supprimée avec succès.',
    /* SMS */
    smsNotSent: 'SMS non envoyé.',
    smsSent: 'SMS bien envoyé.',
    smsListFound: 'Liste enregistrement SMS trouvée.',
    /* Activation Code */
    activationCodeCreated: 'Code activation créé.',
    activationCodeNotFoundOrInvalid: 'Code activation non trouvé ou invalide.',
    activationCodeValidated: 'Code activation validé.',
    refreshTokenNotFound: 'Refresh token not found.',
    activationCodeDeleted: 'Données d\'activations bien effacées.',
    /* Role */
    roleCreated: 'Rôle créé.',
    roleDeleted: 'Rôle effacé.',
    roleUpdated: 'Rôle mis à jour.',
    rolesNotFound: 'Rôles non trouvés.',
    rolesFound: 'Rôles trouvés.',
    roleNotFound: 'Role non trouvé.',
    roleExists: 'Role déjà existant.',
    roleRemoved: 'Role supprimé.',
    /* Droits */
    rightCreated: 'Droit crée.',
    rightRemoved: 'Droit supprimé.',
    rightUpdated: 'Droit mis a jour.',
    rightsFound: 'Droits trouvés',
    rightsNotFound: 'Droits non trouvés.',
    rightNotFound: 'Droit non trouvé.',
    rightExists: 'Droit déjà existant.',
    rightsDoNotExist: 'Droit inexistant.',
    /* Email */
    emailSent: 'Email envoyé avec succès.',
    /* Reset password token */
    resetPasswordTokenFound: 'Token de changement de password trouvé.',
    resetPasswordTokenNotFound: 'Token de changement de password non trouvé.',
    /* ID number */
    idNumberCreated: 'Matricule créé.',
    /* Uploader */
    fileNotFound: 'Fichier non trouvé.',
    fileFound: 'Fichier trouvé.',
    fileDeleted: 'Fichier supprimé.',
    folderCreated: 'Dossier créé.',
    folderCreationFailure: 'La création de dossier a échouée.',
    fileCreated: 'Fichier créé.',
    uploadNotAllowed: 'Téléchargement non autorisé.',
    /* Company */
    companiesFound: 'Entreprises trouvées.',
    companyFound: 'Entreprise trouvée.',
    companyNotFound: 'Entreprise non trouvée.',
    companyCreated: 'Entreprise créée.',
    companyDeleted: 'Entreprise supprimée.',
    companyExists: 'Entreprise déjà existante.',
    companyServicesFound: 'Services de l\'entreprise trouvés.',
    companyServiceCreated: 'Service de l\'entreprise créé.',
    companyServiceDeleted: 'Service de l\'entreprise supprimé.',
    companyServicesNotFound: 'Services de l\'entreprise non trouvés.',
    companyServiceNotFound: 'Service de l\'entreprise non trouvé.',
    companyServicesUpdated: 'Service de l\'entreprise modifié.',
    companyInternalHourCreated: 'Heure interne de l\'entreprise créée.',
    companyInternalHourNotFound: 'Heure interne de l\'entreprise non trouvée.',
    companyInternalHourUpdated: 'Heure interne de l\'entreprise modifiée.',
    companyInternalHoursNotFound: 'Heures internes de l\'entreprise non trouvées.',
    companyInternalHoursFound: 'Heures internes de l\'entreprise trouvées.',
    companyInternalHourRemoved: 'Heure interne de l\'entreprise supprimé.',
    companyInternalHourCreationNotAllowed: 'Creation de l\'heure interne non autorisée.',
    companyInternalHourDeletionNotAllowed: 'Suppression de l\'heure interne non autorisée.',
    companyThirdPartyPayerCreated: 'Tiers payeur de l\'entreprise créé.',
    companyThirdPartyPayersFound: 'Tiers payeurs de l\'entreprise trouvés.',
    companyThirdPartyPayersNotFound: 'Tiers payeurs de l\'entreprise non trouvés.',
    companyThirdPartyPayerUpdated: 'Tiers payeur de l\'entreprise modifié.',
    companyThirdPartyPayerDeleted: 'Tiers payeur de l\'entreprise supprimé.',
    companySectorCreated: 'Secteur de l\'entreprise créé.',
    /* User contracts */
    userContractsFound: "Contrats de l'utilisateur trouvés.",
    userContractUpdated: "Contrat de l'utilisateur mis à jour.",
    userContractAdded: "Contrat de l'utilisateur ajouté.",
    userContractRemoved: "Contrat de l'utilisateur supprimé.",
    /* User contracts amendments */
    userContractVersionAdded: "Avenant au contrat de l'utilisateur ajouté.",
    userContractVersionRemoved: "Avenant au contrat de l'utilisateur supprimé.",
    userContractVersionUpdated: "Avenant au contrat de l'utilisateur modifié.",
    /* User absences */
    userAbsencesFound: "Absences de l'utilisateur trouvées.",
    userAbsenceUpdated: "Absence de l'utilisateur mise à jour.",
    userAbsenceAdded: "Absence de l'utilisateur ajoutée.",
    userAbsenceRemoved: "Absence de l'utilisateur supprimée.",
    /* User tasks */
    userTasksFound: "Tâches de l'utilisateur trouvés",
    /* Customers */
    customersFound: 'Bénéficiaires trouvés.',
    customerFound: 'Bénéficiaire trouvé.',
    customerNotFound: 'Bénéficiaire non trouvé.',
    customerCreated: 'Bénéficiaire créé.',
    customerUpdated: 'Bénéficiaire mis à jour.',
    customerRemoved: 'Bénéficiaire supprimé',
    customerHelperDeleted: 'Aidant du bénéficiaire supprimé.',
    customerSubscriptionsFound: 'Abonnements du bénéficiaire trouvés',
    customerSubscriptionsNotFound: 'Abonnements du bénéficiaire non trouvés',
    customerSubscriptionAdded: 'Abonnement du bénéficiaire ajouté.',
    customerSubscriptionUpdated: 'Abonnement du bénéficiaire mis à jour.',
    customerSubscriptionRemoved: 'Abonnement du bénéficiaire supprimé.',
    serviceAlreadySubscribed: 'Le bénéficiaire est déjà abonné à ce service',
    customerMandateUpdated: 'Mandat du bénéficiaire mis à jour',
    customerMandatesFound: 'Mandats du bénéficiaire trouvés',
    customerMandateNotFound: 'Mandat du bénéficiaire non trouvé',
    customerQuotesFound: 'Devis du bénéficiaire trouvés.',
    customerQuoteAdded: 'Devis du bénéficiaire ajouté.',
    customerQuoteRemoved: 'Devis du bénéficiaire supprimé.',
    signedDocumentSaved: 'Document signé enregistré.',
    customerSubscriptionHistoryAdded: "Historique de l'abonnement du bénéficiaire ajouté.",
    customerFundingConflict: 'Le service est déjà utilisé par un autre financement.',
    customerFundingNotFound: 'Financement du bénéficiaire non trouvé.',
    customerFundingCreated: 'Financement du bénéficiaire créé.',
    customerFundingUpdated: 'Financement du bénéficiaire modifié.',
    customerFundingsFound: 'Financements du bénéficiaire trouvés.',
    customerFundingRemoved: 'Financement du bénéficiaire supprimé.',

    /* ESign */
    signatureRequestCreated: 'Demande de signature créée.',
    documentNotFound: 'Document eversign non trouvé.',
    documentFound: 'Document eversign trouvé.',

    /* Google drive */
    googleDriveFolderCreationFailed: 'Echec de la création du dossier google drive.',
    googleDriveFolderNotFound: 'Dossier google drive non trouvé.',
    googleDriveFileNotFound: 'Fichier google drive non trouvé.',

    /* Events */
    eventsNotFound: 'Evènements non trouvés',
    eventNotFound: 'Evènement non trouvé',
    eventsFound: 'Evènement trouvé',
    eventCreated: 'Evènement crée',
    eventUpdated: 'Evènement mis à jour',
    eventDeleted: 'Evènement supprimé',

    /* Google Map */
    distanceMatrixFound: 'Distance Matrix trouvée',
    distanceMatrixNotFound: 'Distance Matrix non trouvée',

    /* Task */
    taskFound: 'Tâche trouvée',
    taskNotFound: 'Tâche non trouvée',
    tasksFound: 'Tâches trouvées',
    tasksNotFound: 'Tâches non trouvées',
    taskCreated: 'Tâche crée',
    taskUpdated: 'Tâche mis à jour',
    taskDeleted: 'Tâche supprimé',
  }
};
