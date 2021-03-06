const { ensureVaultContentsEncrypted, vaultContentsEncrypted } = require("../../../source/node/tools/validation.js");

const ENCRYPTED_VAULT =
    "b~>buttercup/aEXitErfO7Re0Hzi2egKAJLjxbC0GdoOY8y+OvUfsVFyc+Kbxr3a9gcWc8fTdlv6oflML9h3sFWYAphpeJSHzDv0MLJTGbZZ90a2CRdjjv8vRBsY/SF0lIKCqKenwZicWgNO9eyvAzvRV3JmLjY6x7JA7gO6Z8v+cwpfwWtx/nbRdLMvWUB2tY7XHpi7VEcDw+H53gyj0qPmkFN2wXMOdctTJINbfwJ7PFqJ5fpZewx55YwzZG1YQJj9wGB9DbI4ht9owIwiB8BQUIbZF0DNO0TSA/CXSPc4fYbaseE66b2Ec8C7rrm9y2vaai1WsouPGGLj7PF5SeLXFowbtU/3ZpCWIKQRYEym7Cg6hwXEmAz0urObsQgRo5kjrGe7QAnptreY+KjtCr/52Smv+Sy3JpENlYupvKvrdqNSyA0hCnJaIWaxW4MwJQkCws6qSDF6amz6Tvoy2VxggooZEWhXf7Nj/oHTYMrOWxo2kRYB3GwFBdtrv4lHvlZ2VmYkM48AmEh71s4wveI9EEJ8pjQtKi7LYx+OP4ie0y5HjflzMofi33Ohy0pXchPHFkREkFxml+f983GAzuWwbjE1mF+QiXP4h+HRApRV7VJFzATQ1CNydU4tF/dyJ53mvt3DeufpQ2EHRpy6X0wpV2WeqfbaNgohaYByyqPDW2HLpwtPsozrc7pifqa6oopFgevz+MaUx67DHwFUqXXrWZrQTnPj1jQ==$0b4a4be1e42e7bdbb48300caf54ffe1e$54a9f1d1988a$4f42ad72c76894c62d59814e7e6a28eb03c67a24dd9e80167dd02a0a77f33426$6007";

describe("tools/validation", function() {
    describe("ensureVaultContentsEncrypted", function() {
        it("does not throw for encrypted content", function() {
            expect(() => {
                ensureVaultContentsEncrypted(ENCRYPTED_VAULT);
            }).to.not.throw();
        });

        it("does throw for unencrypted content", function() {
            expect(() => {
                ensureVaultContentsEncrypted('{"test":123}');
            }).to.throw(/Expected encrypted/i);
        });
    });

    describe("vaultContentsEncrypted", function() {
        it("recognises encrypted content", function() {
            expect(vaultContentsEncrypted(ENCRYPTED_VAULT)).to.be.true;
        });

        it("recognises unencrypted content", function() {
            expect(vaultContentsEncrypted('{"test":123}')).to.be.false;
        });

        it("recognises non-strings", function() {
            expect(vaultContentsEncrypted({})).to.be.false;
            expect(vaultContentsEncrypted([])).to.be.false;
            expect(vaultContentsEncrypted(new Date())).to.be.false;
        });
    });
});
