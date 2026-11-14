import {createSubmissionTransport} from '/app/smtp-transport.mjs';
const transport=createSubmissionTransport();try{await transport.sendMail({from:'sender@fixture.test',to:'fixture-user@fixture.test',subject:'isolated held queue fixture',text:'local fixture; never external',headers:{'X-Platform-Hold':'true'}});}finally{transport.close();}
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'test.platform.queue.submit',status:'success',recipientDomain:'fixture.test'}));
