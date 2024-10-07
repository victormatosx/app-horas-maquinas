import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    padding: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#2F2F2F',
    marginBottom: 50,
    textAlign: 'center',
  },
  formButton: {
    backgroundColor: '#2a9d8f',
    paddingVertical: 20,
    paddingHorizontal: 130, 
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 50,
  },
  logoutButtonContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#d9534f',
    paddingVertical: 20,
    paddingHorizontal: 130,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
