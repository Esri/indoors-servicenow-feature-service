# Configure launch actions for Indoors (ServiceNow)

ArcGIS Indoors offers a launch action button to report incidents for items
currently displayed in the info panel. The launch button can be configured to
launch a third party incident form, such as ServiceNow. When clicked, the action
button will open the appropriate web form in a browser, and automatically fill
out form fields with values specified in the URL. The following sections explain
the functionality available with these URLs, and how to configure them properly
for ServiceNow.

## Set up the action button

Launch actions can be configured in ArcGIS Pro or in Indoor Viewer.
An actionable URL must be specified to enable
the launch action button. The invoked system will then be able to parse this URL.
For more information, see [Configure launch actions](https://pro.arcgis.com/en/pro-app/latest/help/data/indoors/configure-launch-actions-for-indoors-apps.htm) and [Launch action syntax](https://pro.arcgis.com/en/pro-app/latest/help/data/indoors/launch-action-syntax.htm).

## Syntax

Launch action functionality is enabled by URLs and the syntax must follow URL conventions.
For example, special characters in the arguments must be URL encoded.

For Indoors, values must be contained in curly brackets and match the following
syntax:

sysparm_query=field1={Layer.Attribute}\^field2={Attribute}

> Note:
The layer is optional, and if left out, it will default to the current item for
which the launch action button is clicked. Many launch action use cases will require passing
attributes from a different layer in the map or scene. This is supported with
the layer operator. Arguments and values are not case-sensitive.

See the following samples.

#### Single value

sysparm_query=name={KNOWNAS}\^building={facility_name}\^space={Units.Name}

#### Multiple values

sysparm_query=center={shape.y},{shape.x}

### Value from another feature class

sysparm_query=site={FACILITIES.SITE_ID}

## Example URLs

Below you will find a list of example URLs that demonstrate ways of configuring
launch actions for ServiceNow. For more information, see the [ServiceNow URL Schema](https://docs.servicenow.com/bundle/madrid-platform-user-interface/page/use/navigation/reference/r_NavigatingByURLExamples.html).

Schema: https://\<baseURL\>/nav_to.do?uri=\<table
name\>.do?sys_id=-1%26sysparm_query=\<field1=value1\>\^\<field2=value2\>

| Description                                                                                                                                                                                                                                                                                                                         | Example                                                                                                                                                                                |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Opens a new Incident form in the standard interface with a priority of **1**, an incident state of **In Progress**, and sets the location to the name field from the UNITS layer.                                                                                                                                                   | https://\<instance name\>.service-now.com/nav_to.do?uri=incident.do?sys_id=-1%26sysparm_query=priority=1\^state=2\^location={UNITS.name}                                               |
| You can also use JavaScript to access [GlideSystem](https://docs.servicenow.com/bundle/madrid-platform-user-interface/page/script/glide-server-apis/concept/c_GlideSystem.html#c_GlideSystem) methods. The following example creates the same type of incident as above, and also populates the caller ID with the current user ID. | https://\<instance name\>.service-now.com/nav_to.do?uri=incident.do?sys_id=-1%26sysparm_query=priority=1\^state=2\^location={UNITS.name}\^caller_id=javascript:gs.getUserID()          |
| Obtain a value from a specific layer (Units), and another value from the currently selected feature in Indoors                                                                                                                                                                                                                      | https://\<instance name\>.service-now.com/nav_to.do?uri=incident.do?sys_id=-1%26sysparm_query=location={Units.Name}\^short_description={name_long}                                     |
| Pass multiple values for a single field                                                                                                                                                                                                                                                                                             | https://\<instance name\>.service-now.com/nav_to.do?uri=incident.do?sys_id=-1%26sysparm_query=coordinates={shape.y},{shape.x}                                                          |
| Pass parameters using the mobile view                                                                                                                                                                                                                                                                                               | https://\<instance name\>.service-now.com/\$m.do\#/form/incident/-1?sysparm_query=caller_id=javascript:gs.user_id()\^location={Units.Name}\^short_description={facilities.DESCRIPTION} |

> Note:
> -   Some characters might not be supported when passing values to ServiceNow,
    such as the \# or + characters.
> -   As a data curation step, the PREVIOUS \$m.do\# URL should only be configured
    in the MMPK and nav_to.do URL format in the Indoors web app.
> -   The \$m.do\# URL format, when launched from the launch actions button within Indoors, is supported
    on both the mobile ServiceNow Classic app and mobile browser on iOS and
    Android devices.



# ServiceNow configuration for launch action location

Additional configuration is required for the location values loaded into
ServiceNow using the ServiceNow Location Loader python tool to populate the
Location text box within ServiceNow when using ArcGIS Indoors launch action functionality.

## Disable the (BP) Set Location to User script

By default, ServiceNow enables a script that automatically populates the
Location field for an incident with the location of the user that is signed in. This will need to be disabled for ArcGIS Indoors to pass the location when using launch actions. To do this, perform the following steps.

1.  Sign in to the ServiceNow service management instance with administrative
    privileges.

2.  On the left side panel, click **All Applications**.

3.  In the **Filter** navigation text box, type **client scripts**.

4.  In the left side menu, click **System Definition** \> **Client Scripts**.

5.  On the Client Scripts page, under the Table filter, type **incident**, then
    press the Enter key.

6.  In the list, locate and click **(BP) Set Location to User**.

7.  Uncheck the **Active** check box, and click **Update**.

## Create client scripts

ServiceNow associates each location loaded into ServiceNow with a sys_id that
only it knows about, which it uses to populate the Location text box. For
Indoors to populate the Location text box using launch actions, a script will need to be
configured to convert the text location from Indoors into a sys_id that
ServiceNow recognizes. To do this, perform the following steps.

## Location client script (desktop)

Currently, separate scripts are required to populate the location for desktop
browsers and mobile devices. The following are steps to configure the script for
desktop browsers.

1.  Sign in to the ServiceNow service management instance with administrative
    privileges.

2.  On the left side panel, click **All Applications**.

3.  In the **Filter** navigation text box, type **client scripts**.

4.  In the left side menu, click **System Definition** \> **Client Scripts**.

5.  On the Client Scripts page, click **New**.

6.  Set the following:

    a.  Name: Location for ArcGIS Indoors (desktop)
    
    b.  Table: Incident [incident]
    
    c.  UI Type: Desktop
    
    d.  Type: onload
    
    e.  Application: Global
    
    f.  Active: Checked
    
    g.  Inherited: Unchecked
    
    h.  Global: Checked
    
    i.  Description: This script reads the location value passed from the URL     as part of the sysparm_query.
    
    j. Messages: \<Optional\>
    
    k. Script
    ```
        function onLoad(){
            var loc;
            var query_param = getParmVal('sysparm_query');
            var param = query_param.split("^");
            for(var index=0; index<param.length; index++){
                var sub_param = param[index].split("=");
                if(sub_param[0].toUpperCase() == "LOCATION"){
                    loc = sub_param[1];
                }
            }
            g_form.getReference('location');
            var ga = new GlideAjax('Location_Query');
            ga.addParam('sysparm_name', 'querySysID');
            ga.addParam('location_name', loc);
            ga.getXML(myCallBack);

        }

        function myCallBack(response){
            var output = response.responseXML.documentElement.getAttribute('answer');
            g_form.setValue('location', output);
        }

        function getParmVal(name){
            var url = document.URL.parseQuery();
            if(url[name]){
                return decodeURI(url[name]);
            }
            else{
                return "not found";
            }
        }
        
7.  Click **Submit**.

## Location client script (mobile)

Currently, separate scripts are required to populate the location for desktop
browsers and mobile devices. The following are steps to configure the script for
mobile devices.

1.  Sign in to the ServiceNow service management instance with administrative
    privileges.

2.  On the left side panel, click **All Applications**.

3.  In the **Filter** navigation text box, type **client scripts**.

4.  In the left side menu, click **System Definition** \> **Client Scripts.**

5.  On the Client Scripts page, click **New**.

6.  Set the following:

    a.  Name: Location for ArcGIS Indoors (Mobile)
    
    b.  Table: Incident [incident]
    
    c.  UI Type: Mobile / Service Portal
    
    d.  Type: onload
    
    e.  Application: Global
    
    f.  Active: Checked
    
    g.  Inherited: Unchecked
    
    h.  Global: Checked
    
    i.  Description: This script reads the location value passed from the URL     as part of the sysparm_query.
    
    j. Messages: \<Optional\>
    
    k. Script:
```
    function onLoad(){
        var loc;
        var query_param = getParmVal('sysparm_query');
        var param = query_param.split("^");
        for(var index=0; index<param.length; index++){
            var sub_param = param[index].split("=");
            if(sub_param[0].toUpperCase() == "LOCATION"){
                loc = sub_param[1];
            }
        }
        g_form.getReference('location');
        var ga = new GlideAjax('Location_Query');
        ga.addParam('sysparm_name', 'querySysID');
        ga.addParam('location_name', loc);
        ga.getXML(myCallBack);
    }

    function myCallBack(response){
        var output = response.responseXML.documentElement.getAttribute('answer');
        g_form.setValue('location', output);
    }

    function getParmVal(name) {  
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");  
        var regexS = "[\\?&]" + name + "=([^&#]*)";  
        var regex = new RegExp(regexS);  
        var results = regex.exec(top.location);  
        if (results == null) {  
            return "";  
        } else {  
            return unescape(results[1]);  
        }  
    }
```
    
7.  Click **Submit**.

## Script Include (server-side script)

To improve performance, a portion of the client-side script will be separated
into a server-side script, which will handle querying the location table. To do
this, perform the following steps.

1.  Sign in to the ServiceNow service management instance with administrative
    privileges.

2.  On the left side panel, click **All Applications**.

3.  In the **Filter** navigation text box, type **script includes**.

4.  In the left side menu, click **System Definition** \> **Script Includes.**

5.  On the Client Scripts page, click **New**.

6.  Set the following:

    a.  Name: Location_Query
    
    b.  API Name: global.Location_Query
    
    c.  Client callable: Checked
    
    d.  Application: Global
    
    e.  Accessible from: This application scope only
    
    f.  Active: Checked
    
    g.  Description: This script queries the cmn_location table and is client
        callable.
        
    h.  Script:
```
    var Location_Query = Class.create();
    Location_Query.prototype = Object.extendsObject(AbstractAjaxProcessor, {
        querySysID: function(){
            var loc_name = this.getParameter('location_name');
            var getLocation = new GlideRecord('cmn_location');
            getLocation.addQuery('name','=',loc_name);
            getLocation.query();
            while (getLocation.next()) {
                if(getLocation.name.toUpperCase() == loc_name.toUpperCase()){
                    return getLocation.sys_id;
                }
            }
        },
        type: 'Location_Query'
    });
```

    i.  Protection policy: -- None --

7.  Click **Submit**.

-----
